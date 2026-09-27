import { Request, Response } from 'express';
import prisma from '../lib/db';

export class AnalyticsController {
  static async getSummary(req: Request, res: Response) {
    try {
      const timeRange = (req.query.range as string) || '30d';
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let dateFilter: Date | undefined;
      if (timeRange === 'today') dateFilter = todayStart;
      else if (timeRange === '7d') dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (timeRange === '30d') dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (timeRange === 'this_month') dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);

      const whereOrders: any = dateFilter ? { createdAt: { gte: dateFilter } } : {};

      const [
        paidOrdersAgg,
        todayPaidAgg,
        totalOrdersCount,
        pendingOrdersCount,
        completedOrdersCount,
        statusGroup,
        rangeOrders,
        totalCustomers,
        lowStockProducts,
        categories,
        recentOrders,
      ] = await Promise.all([
        prisma.order.aggregate({
          where: { paymentStatus: 'PAID' },
          _sum: { total: true },
          _count: { id: true },
        }),
        prisma.order.aggregate({
          where: { createdAt: { gte: todayStart }, paymentStatus: 'PAID' },
          _sum: { total: true },
        }),
        prisma.order.count(),
        prisma.order.count({
          where: { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } },
        }),
        prisma.order.count({
          where: { status: 'DELIVERED' },
        }),
        prisma.order.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        prisma.order.findMany({
          where: whereOrders,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            createdAt: true,
            paymentStatus: true,
            total: true,
            items: {
              select: {
                productId: true,
                productName: true,
                productSku: true,
                quantity: true,
                total: true,
              },
            },
          },
        }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.product.count({ where: { stock: { lte: 5 }, status: 'ACTIVE' } }),
        prisma.category.findMany({
          select: {
            name: true,
            products: {
              select: {
                orderItems: { select: { total: true, quantity: true } },
              },
            },
          },
        }),
        prisma.order.findMany({
          take: 6,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            city: true,
            state: true,
            status: true,
            total: true,
            paymentStatus: true,
            createdAt: true,
          },
        }),
      ]);

      const totalRevenue = paidOrdersAgg._sum.total || 0;
      const paidOrdersCount = paidOrdersAgg._count.id || 0;
      const todayRevenue = todayPaidAgg._sum.total || 0;
      const pendingOrders = pendingOrdersCount;
      const completedOrders = completedOrdersCount;
      const averageOrderValue = paidOrdersCount > 0 ? Math.round(totalRevenue / paidOrdersCount) : 0;

      const salesByCategory = categories.map((cat) => {
        let revenue = 0;
        let count = 0;
        cat.products.forEach((prod) => {
          prod.orderItems.forEach((oi) => {
            revenue += oi.total;
            count += oi.quantity;
          });
        });
        return { category: cat.name, revenue, count };
      }).sort((a, b) => b.revenue - a.revenue);

      const dateMap: Record<string, { date: string; revenue: number; orders: number }> = {};
      rangeOrders.forEach((o) => {
        const d = new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dateMap[d]) dateMap[d] = { date: d, revenue: 0, orders: 0 };
        dateMap[d].orders += 1;
        if (o.paymentStatus === 'PAID') dateMap[d].revenue += o.total;
      });

      const salesByDate = Object.values(dateMap);

      const statusDistribution = statusGroup.map((g) => ({
        status: g.status,
        count: g._count.id,
      }));

      const productAggregation: Record<string, {
        id: string;
        name: string;
        sku: string;
        soldCount: number;
        revenue: number;
      }> = {};

      rangeOrders.forEach((o) => {
        o.items.forEach((it) => {
          if (!productAggregation[it.productId]) {
            productAggregation[it.productId] = {
              id: it.productId,
              name: it.productName,
              sku: it.productSku,
              soldCount: 0,
              revenue: 0,
            };
          }
          productAggregation[it.productId].soldCount += it.quantity;
          productAggregation[it.productId].revenue += it.total;
        });
      });

      const topProducts = Object.values(productAggregation)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return res.json({
        success: true,
        data: {
          totalRevenue,
          todayRevenue,
          totalOrders: totalOrdersCount,
          pendingOrders,
          completedOrders,
          totalCustomers,
          lowStockCount: lowStockProducts,
          averageOrderValue,
          salesByCategory,
          salesByDate,
          statusDistribution,
          topProducts,
          recentOrders,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
