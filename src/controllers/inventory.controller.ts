import { Request, Response } from 'express';
import prisma from '../lib/db';
import { InventoryService } from '../services/inventory';

export class InventoryController {
  static async getAll(req: Request, res: Response) {
    try {
      const lowStockOnly = req.query.lowStockOnly === 'true';
      const search = (req.query.search as string) || '';

      const where: any = { status: 'ACTIVE' };
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { sku: { contains: search } },
        ];
      }

      const products = await prisma.product.findMany({
        where,
        orderBy: { stock: 'asc' },
        include: {
          category: { select: { name: true } },
          inventory: true,
        },
      });

      const inventoryList = products
        .map((p) => ({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category.name,
          currentStock: p.stock,
          lowStockThreshold: p.lowStockThreshold,
          isLowStock: p.stock <= p.lowStockThreshold,
          isOutOfStock: p.stock <= 0,
          price: p.price,
        }))
        .filter((item) => (lowStockOnly ? item.isLowStock : true));

      const totalProducts = products.length;
      const lowStockCount = inventoryList.filter((i) => i.isLowStock).length;
      const outOfStockCount = inventoryList.filter((i) => i.isOutOfStock).length;

      return res.json({
        success: true,
        data: {
          items: inventoryList,
          summary: {
            totalProducts,
            lowStockCount,
            outOfStockCount,
            healthyStockCount: totalProducts - lowStockCount,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async adjust(req: Request, res: Response) {
    try {
      const { productId, adjustment, reason } = req.body;
      if (!productId || adjustment === undefined || isNaN(Number(adjustment))) {
        return res.status(400).json({ success: false, message: 'Product ID and adjustment are required.' });
      }

      const result = await InventoryService.adjustStock(
        productId,
        Number(adjustment),
        reason || 'Admin manual correction'
      );

      return res.json({
        success: true,
        message: `Stock updated. Current level is ${result.newStock} units.`,
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getHistory(req: Request, res: Response) {
    try {
      const productId = req.query.productId as string;
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));

      const where: any = {};
      if (productId) where.productId = productId;

      const logs = await prisma.inventoryTransaction.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true, sku: true } } },
      });

      return res.json({ success: true, data: logs });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
