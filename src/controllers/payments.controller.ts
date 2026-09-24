import { Response } from 'express';
import prisma from '../lib/db';
import { AuthenticatedRequest } from '../types';
import { RazorpayService } from '../services/razorpay';
import { InventoryService } from '../services/inventory';
import { NotificationService } from '../services/notification';
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

      const razorpayOrder = await RazorpayService.createOrder({
        amount: grandTotal,
        receipt: orderNumber,
        notes: { orderNumber, customerEmail },
      });

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
          paymentMethod: 'RAZORPAY',
          razorpayOrderId: razorpayOrder.id,
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
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
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

      if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Missing payment verification parameters.' });
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

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order record not found.' });
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

      await NotificationService.createNotification({
        userId: order.userId,
        title: 'Order Confirmed!',
        message: `Your payment for Order #${order.orderNumber} was confirmed. We are packing your sarees!`,
        type: 'PAYMENT',
        link: `/track-order?orderId=${order.orderNumber}`,
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
}
