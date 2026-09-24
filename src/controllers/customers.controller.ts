import { Request, Response } from 'express';
import prisma from '../lib/db';

export class CustomersController {
  static async getAll(req: Request, res: Response) {
    try {
      const search = (req.query.search as string) || '';
      const where: any = { role: 'CUSTOMER' };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      const customers = await prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          addresses: { where: { isDefault: true } },
          orders: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              status: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
      });

      const formatted = customers.map((c) => {
        const paidOrders = c.orders.filter((o) => o.paymentStatus === 'PAID');
        const totalSpent = paidOrders.reduce((acc, o) => acc + o.total, 0);

        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          createdAt: c.createdAt,
          avatarUrl: c.profile?.avatarUrl,
          defaultAddress: c.addresses[0] || null,
          orderCount: c.orders.length,
          totalSpent,
          lastOrderDate: c.orders[0]?.createdAt || null,
        };
      });

      return res.json({ success: true, data: formatted });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
