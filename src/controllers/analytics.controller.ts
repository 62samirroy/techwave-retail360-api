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
        allOrders,
        todayOrders,
        rangeOrders,
        totalCustomers,
        lowStockProducts,
        categories,
      ] = await Promise.all([
        prisma.order.findMany({ select: { id: true, total: true, status: true, paymentStatus: true, createdAt: true } }),
        prisma.order.findMany({ where: { createdAt: { gte: todayStart } }, select: { total: true, paymentStatus: true } }),
        prisma.order.findMany({ where: whereOrders, orderBy: { createdAt: 'desc' }, include: { items: true } }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.product.count({ where: { stock: { lte: 5 }, status: 'ACTIVE' } }),
        prisma.category.findMany({
          include: {
            products: {
              select: {
                id: true,
                orderItems: { select: { total: true, quantity: true } },
              },
            },
          },
        }),
      ]);

      const paidOrdersAll = allOrders.filter((o) => o.paymentStatus === 'PAID');
      const totalRevenue = paidOrdersAll.reduce((acc, o) => acc + o.total, 0);

      const todayPaidOrders = todayOrders.filter((o) => o.paymentStatus === 'PAID');
      const todayRevenue = todayPaidOrders.reduce((acc, o) => acc + o.total, 0);

      const pendingOrders = allOrders.filter((o) =>
        ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(o.status)
      ).length;

      const completedOrders = allOrders.filter((o) => o.status === 'DELIVERED').length;
      const averageOrderValue = paidOrdersAll.length > 0 ? Math.round(totalRevenue / paidOrdersAll.length) : 0;

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

      const statusCounts: Record<string, number> = {};
      allOrders.forEach((o) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      });
      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

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
          totalOrders: allOrders.length,
          pendingOrders,
          completedOrders,
          totalCustomers,
          lowStockCount: lowStockProducts,
          averageOrderValue,
          salesByCategory,
          salesByDate,
          statusDistribution,
          topProducts,
          recentOrders: rangeOrders.slice(0, 5),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
