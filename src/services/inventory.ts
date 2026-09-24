import prisma from '../lib/db';

export class InventoryService {
  static async deductStock(
    items: { productId: string; quantity: number }[],
    orderNumber: string
  ): Promise<boolean> {
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) continue;

      const previousStock = product.stock;
      const newStock = Math.max(0, previousStock - item.quantity);

      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: newStock },
      });

      await prisma.inventory.upsert({
        where: { productId: item.productId },
        create: {
          productId: item.productId,
          currentStock: newStock,
          lowStockAlert: newStock <= product.lowStockThreshold,
        },
        update: {
          currentStock: newStock,
          lowStockAlert: newStock <= product.lowStockThreshold,
        },
      });

      await prisma.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'ORDER_DEDUCT',
          quantityChange: -item.quantity,
          previousStock,
          newStock,
          referenceId: orderNumber,
          notes: `Stock auto-deducted for confirmed order ${orderNumber}`,
        },
      });
    }

    return true;
  }

  static async restoreStock(
    items: { productId: string; quantity: number }[],
    orderNumber: string,
    reason: string = 'Order cancelled'
  ): Promise<boolean> {
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) continue;

      const previousStock = product.stock;
      const newStock = previousStock + item.quantity;

      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: newStock },
      });

      await prisma.inventory.upsert({
        where: { productId: item.productId },
        create: {
          productId: item.productId,
          currentStock: newStock,
          lowStockAlert: newStock <= product.lowStockThreshold,
        },
        update: {
          currentStock: newStock,
          lowStockAlert: newStock <= product.lowStockThreshold,
        },
      });

      await prisma.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'ORDER_CANCEL_RESTORE',
          quantityChange: item.quantity,
          previousStock,
          newStock,
          referenceId: orderNumber,
          notes: `Stock restored: ${reason}`,
        },
      });
    }

    return true;
  }

  static async adjustStock(
    productId: string,
    adjustment: number,
    reason: string
  ): Promise<{ success: boolean; newStock: number }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) throw new Error('Product not found');

    const previousStock = product.stock;
    const newStock = Math.max(0, previousStock + adjustment);

    await prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    await prisma.inventory.upsert({
      where: { productId },
      create: {
        productId,
        currentStock: newStock,
        lowStockAlert: newStock <= product.lowStockThreshold,
      },
      update: {
        currentStock: newStock,
        lowStockAlert: newStock <= product.lowStockThreshold,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        productId,
        type: adjustment > 0 ? 'RESTOCK' : 'ADJUSTMENT',
        quantityChange: adjustment,
        previousStock,
        newStock,
        referenceId: 'MANUAL_ADMIN',
        notes: reason || 'Manual adjustment by admin',
      },
    });

    return { success: true, newStock };
  }
}
