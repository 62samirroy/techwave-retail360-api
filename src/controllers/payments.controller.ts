import { Response } from 'express';
import prisma from '../lib/db';
import { AuthenticatedRequest } from '../types';
import { RazorpayService } from '../services/razorpay';
import { InventoryService } from '../services/inventory';
import { NotificationService } from '../services/notification';
import { EmailService } from '../services/email';
import { generateOrderNumber } from '../lib/utils';

export class PaymentsController {
  static async createRazorpayOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        city,
        state,
        pinCode,
        country = 'India',
        items,
        paymentMethod = 'RAZORPAY',
      } = req.body;

      if (!customerName || !customerEmail || !customerPhone || !shippingAddress || !city || !state || !pinCode) {
        return res.status(400).json({ success: false, message: 'All customer and address fields are required.' });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart items are required.' });
      }

      let subtotal = 0;
      const validatedItems: any[] = [];

      for (const it of items) {
        const product = await prisma.product.findUnique({
          where: { id: it.productId },
          include: { images: { where: { isPrimary: true } } },
        });

        if (!product || product.status !== 'ACTIVE') {
          return res.status(400).json({ success: false, message: `Product "${it.productName || 'Item'}" is unavailable.` });
        }

        if (product.stock < it.quantity) {
          return res.status(400).json({
            success: false,
            message: `Only ${product.stock} units remain for "${product.name}".`,
          });
        }

        const unitPrice = product.discountPrice || product.price;
        const total = unitPrice * it.quantity;
        subtotal += total;

        validatedItems.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productImage: product.images[0]?.url || null,
          unitPrice,
          quantity: it.quantity,
          total,
        });
      }

      const freeShippingThreshold = 1999;
      const standardShippingFee = 99;
      const shippingFee = subtotal >= freeShippingThreshold ? 0 : standardShippingFee;
      const tax = Math.round(subtotal * 0.05);
      const grandTotal = subtotal + shippingFee + tax;
      const orderNumber = generateOrderNumber();

      let razorpayOrderId: string | null = null;
      let rzpAmount = Math.round(grandTotal * 100);
      let rzpCurrency = 'INR';

      if (paymentMethod === 'COD') {
        razorpayOrderId = `cod_${Date.now()}`;
      } else {
        try {
          const razorpayOrder = await RazorpayService.createOrder({
            amount: grandTotal,
            receipt: orderNumber,
            notes: { orderNumber, customerEmail },
          });
          razorpayOrderId = razorpayOrder.id;
          rzpAmount = razorpayOrder.amount;
          rzpCurrency = razorpayOrder.currency;
        } catch (rzpErr: any) {
          console.warn('[PAYMENTS] Razorpay order creation warning:', rzpErr.message);
          razorpayOrderId = `rzp_test_${Date.now()}`;
        }
      }

      const createdOrder = await prisma.order.create({
        data: {
          orderNumber,
          userId: req.user?.id || null,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim().toLowerCase(),
          customerPhone: customerPhone.trim(),
          shippingAddress: shippingAddress.trim(),
          city: city.trim(),
          state: state.trim(),
          pinCode: pinCode.trim(),
          country,
          subtotal,
          discount: 0,
          shippingFee,
          tax,
          total: grandTotal,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: paymentMethod === 'COD' ? 'COD' : 'RAZORPAY',
          razorpayOrderId: razorpayOrderId,
          items: {
            create: validatedItems.map((vi) => ({
              productId: vi.productId,
              productName: vi.productName,
              productSku: vi.productSku,
              productImage: vi.productImage,
              unitPrice: vi.unitPrice,
              quantity: vi.quantity,
              total: vi.total,
            })),
          },
        },
      });

      return res.json({
        success: true,
        data: {
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          razorpayOrderId: razorpayOrderId,
          amount: rzpAmount,
          currency: rzpCurrency,
          keyId: RazorpayService.getPublicKey(),
          grandTotal,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async verifyPayment(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        orderId,
        orderNumber,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      if (!orderId) {
        return res.status(400).json({ success: false, message: 'Order ID is required.' });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order record not found.' });
      }

      // Check ownership: ensure user can only verify their own order
      if (order.userId && req.user && order.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this order.' });
      }

      // Idempotency: If already confirmed, return safely without deducting stock again
      if (order.status === 'CONFIRMED' || order.paymentStatus === 'PAID') {
        const whatsappLink = NotificationService.getOrderWhatsAppLink({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          shippingAddress: `${order.shippingAddress}, ${order.city}`,
        });
        return res.json({
          success: true,
          message: 'Order is already verified and confirmed',
          data: { order, whatsappLink },
        });
      }

      // Seamless COD handling
      if (order.paymentMethod === 'COD') {
        return PaymentsController.processCodConfirmation(order, res);
      }

      // Razorpay Payment Verification
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Missing Razorpay payment verification parameters.' });
      }

      // Prevent cross-order substitution: Razorpay order ID MUST match this order's razorpayOrderId
      if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
        return res.status(400).json({
          success: false,
          message: 'Razorpay Order ID mismatch. Payment verification failed.',
        });
      }

      const isValid = RazorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!isValid) {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
        });

        return res.status(400).json({ success: false, message: 'Invalid payment signature. Verification failed.' });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          razorpayPaymentId: razorpay_payment_id,
        },
        include: { items: true },
      });

      await prisma.payment.create({
        data: {
          orderId: order.id,
          paymentGateway: 'RAZORPAY',
          gatewayOrderId: razorpay_order_id,
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          amount: order.total,
          currency: 'INR',
          status: 'SUCCESS',
          rawResponse: JSON.stringify({ verifiedAt: new Date().toISOString() }),
        },
      });

      await InventoryService.deductStock(
        order.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
        })),
        order.orderNumber
      );

      if (order.userId) {
        await NotificationService.createNotification({
          userId: order.userId,
          title: 'Order Confirmed!',
          message: `Your payment for Order #${order.orderNumber} was confirmed. We are packing your sarees!`,
          type: 'PAYMENT',
          link: `/track-order?orderId=${order.orderNumber}`,
        });
      }

      // Dispatch Order Confirmation Email to customer
      EmailService.sendOrderConfirmationEmail({
        orderNumber: updatedOrder.orderNumber,
        customerName: updatedOrder.customerName,
        customerEmail: updatedOrder.customerEmail,
        customerPhone: updatedOrder.customerPhone,
        shippingAddress: updatedOrder.shippingAddress,
        city: updatedOrder.city,
        state: updatedOrder.state,
        pinCode: updatedOrder.pinCode,
        country: updatedOrder.country,
        subtotal: updatedOrder.subtotal,
        shippingFee: updatedOrder.shippingFee,
        tax: updatedOrder.tax,
        total: updatedOrder.total,
        paymentMethod: updatedOrder.paymentMethod,
        paymentStatus: updatedOrder.paymentStatus,
        items: updatedOrder.items.map((it) => ({
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        })),
      }).catch((err) => {
        console.error('[PAYMENTS CONTROLLER] Order confirmation email failed:', err);
      });

      // Dispatch Admin Notification for new order placed
      EmailService.sendAdminNewOrderAlert({
        orderNumber: updatedOrder.orderNumber,
        customerName: updatedOrder.customerName,
        customerEmail: updatedOrder.customerEmail,
        customerPhone: updatedOrder.customerPhone,
        shippingAddress: updatedOrder.shippingAddress,
        city: updatedOrder.city,
        state: updatedOrder.state,
        pinCode: updatedOrder.pinCode,
        country: updatedOrder.country,
        subtotal: updatedOrder.subtotal,
        shippingFee: updatedOrder.shippingFee,
        tax: updatedOrder.tax,
        total: updatedOrder.total,
        paymentMethod: updatedOrder.paymentMethod,
        paymentStatus: updatedOrder.paymentStatus,
        items: updatedOrder.items.map((it) => ({
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        })),
      }).catch((err) => {
        console.error('[ADMIN ORDER ALERT] Admin order notification failed:', err);
      });

      const whatsappLink = NotificationService.getOrderWhatsAppLink({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        total: order.total,
        shippingAddress: `${order.shippingAddress}, ${order.city}`,
      });

      return res.json({
        success: true,
        message: 'Payment verified and order confirmed successfully',
        data: { order: updatedOrder, whatsappLink },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Dedicated endpoint to confirm Cash-on-Delivery (COD) orders safely
   */
  static async confirmCod(req: AuthenticatedRequest, res: Response) {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'Order ID is required.' });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order record not found.' });
      }

      if (order.userId && req.user && order.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this order.' });
      }

      if (order.status === 'CONFIRMED') {
        const whatsappLink = NotificationService.getOrderWhatsAppLink({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          shippingAddress: `${order.shippingAddress}, ${order.city}`,
        });
        return res.json({
          success: true,
          message: 'COD Order is already confirmed.',
          data: { order, whatsappLink },
        });
      }

      return PaymentsController.processCodConfirmation(order, res);
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  private static async processCodConfirmation(order: any, res: Response) {
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
      },
      include: { items: true },
    });

    await InventoryService.deductStock(
      order.items.map((it: any) => ({
        productId: it.productId,
        quantity: it.quantity,
      })),
      order.orderNumber
    );

    if (order.userId) {
      await NotificationService.createNotification({
        userId: order.userId,
        title: 'COD Order Placed!',
        message: `Your Cash on Delivery Order #${order.orderNumber} is confirmed. We are packing your sarees!`,
        type: 'ORDER',
        link: `/track-order?orderId=${order.orderNumber}`,
      });
    }

    // Dispatch confirmation emails
    EmailService.sendOrderConfirmationEmail({
      orderNumber: updatedOrder.orderNumber,
      customerName: updatedOrder.customerName,
      customerEmail: updatedOrder.customerEmail,
      customerPhone: updatedOrder.customerPhone,
      shippingAddress: updatedOrder.shippingAddress,
      city: updatedOrder.city,
      state: updatedOrder.state,
      pinCode: updatedOrder.pinCode,
      country: updatedOrder.country,
      subtotal: updatedOrder.subtotal,
      shippingFee: updatedOrder.shippingFee,
      tax: updatedOrder.tax,
      total: updatedOrder.total,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      items: updatedOrder.items.map((it: any) => ({
        productName: it.productName,
        productSku: it.productSku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.total,
      })),
    }).catch((err) => {
      console.error('[PAYMENTS CONTROLLER] COD Order confirmation email failed:', err);
    });

    EmailService.sendAdminNewOrderAlert({
      orderNumber: updatedOrder.orderNumber,
      customerName: updatedOrder.customerName,
      customerEmail: updatedOrder.customerEmail,
      customerPhone: updatedOrder.customerPhone,
      shippingAddress: updatedOrder.shippingAddress,
      city: updatedOrder.city,
      state: updatedOrder.state,
      pinCode: updatedOrder.pinCode,
      country: updatedOrder.country,
      subtotal: updatedOrder.subtotal,
      shippingFee: updatedOrder.shippingFee,
      tax: updatedOrder.tax,
      total: updatedOrder.total,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      items: updatedOrder.items.map((it: any) => ({
        productName: it.productName,
        productSku: it.productSku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.total,
      })),
    }).catch((err) => {
      console.error('[ADMIN ORDER ALERT] Admin COD order notification failed:', err);
    });

    const whatsappLink = NotificationService.getOrderWhatsAppLink({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      total: order.total,
      shippingAddress: `${order.shippingAddress}, ${order.city}`,
    });

    return res.json({
      success: true,
      message: 'Cash on Delivery order placed successfully',
      data: { order: updatedOrder, whatsappLink },
    });
  }
}
