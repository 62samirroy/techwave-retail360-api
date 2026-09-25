import { Request, Response } from 'express';
import prisma from '../lib/db';
import { AuthenticatedRequest } from '../types';
import { InventoryService } from '../services/inventory';
import { NotificationService } from '../services/notification';

export class OrdersController {
  static async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const search = (req.query.search as string) || '';
      const status = (req.query.status as string) || '';
      const paymentStatus = (req.query.paymentStatus as string) || '';
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 15));
      const skip = (page - 1) * limit;

      const where: any = {};

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (req.user.role !== 'ADMIN') {
        where.userId = req.user.id;
      } else {
        if (search) {
          where.OR = [
            { orderNumber: { contains: search } },
            { customerName: { contains: search } },
            { customerEmail: { contains: search } },
            { customerPhone: { contains: search } },
          ];
        }
        if (status) where.status = status;
        if (paymentStatus) where.paymentStatus = paymentStatus;
      }

      const [total, orders] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            payments: { select: { id: true, status: true, paymentGateway: true, amount: true } },
          },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          orders,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const order = await prisma.order.findFirst({
        where: { OR: [{ id }, { orderNumber: id }] },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  images: { where: { isPrimary: true } },
                },
              },
            },
          },
          payments: true,
        },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (order.userId) {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.id !== order.userId)) {
          return res.status(403).json({ success: false, message: 'Unauthorized to view this order. Please sign in with the ordering account.' });
        }
      }

      return res.json({ success: true, data: order });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status, paymentStatus, trackingNumber, carrier, notes } = req.body;

      const existingOrder = await prisma.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingOrder) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      if (status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
        await InventoryService.restoreStock(
          existingOrder.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
          existingOrder.orderNumber,
          notes || 'Order cancelled by admin'
        );
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(paymentStatus && { paymentStatus }),
          ...(trackingNumber !== undefined && { trackingNumber }),
          ...(carrier !== undefined && { carrier }),
          ...(notes !== undefined && { notes }),
        },
        include: { items: true },
      });

      if (status && status !== existingOrder.status && existingOrder.userId) {
        await NotificationService.createNotification({
          userId: existingOrder.userId,
          title: `Order Status: ${status}`,
          message: `Your Order #${existingOrder.orderNumber} status is now ${status}.`,
          type: 'ORDER',
          link: `/track-order?orderId=${existingOrder.orderNumber}`,
        });
      }

      return res.json({ success: true, message: 'Order updated successfully', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async track(req: Request, res: Response) {
    try {
      const orderNumber = (req.query.orderNumber as string)?.trim();
      const identifier = (req.query.identifier as string)?.trim().toLowerCase();

      if (!orderNumber) {
        return res.status(400).json({ success: false, message: 'Please enter an Order Number (e.g. TW-ORD-10021)' });
      }

      const where: any = {
        orderNumber: { equals: orderNumber.toUpperCase() },
      };

      if (identifier) {
        where.OR = [
          { customerEmail: { contains: identifier } },
          { customerPhone: { contains: identifier } },
        ];
      }

      const order = await prisma.order.findFirst({
        where,
        include: { items: true },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'No matching order found. Please verify your Order Number.',
        });
      }

      return res.json({ success: true, data: order });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
