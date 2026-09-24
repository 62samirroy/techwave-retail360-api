import { Request, Response } from 'express';
import prisma from '../lib/db';
import { slugify } from '../lib/utils';

export class ProductsController {
  static async getAll(req: Request, res: Response) {
    try {
      const search = (req.query.search as string) || '';
      const category = (req.query.category as string) || '';
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
      const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
      const sort = (req.query.sort as string) || 'newest';
      const inStock = req.query.inStock === 'true';
      const featured = req.query.featured === 'true';
      const bestseller = req.query.bestseller === 'true';
      const statusParam = (req.query.status as string) || '';
      const isAdmin = req.query.admin === 'true';
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 12));
      const skip = (page - 1) * limit;

      const where: any = {};

      if (statusParam && statusParam.toUpperCase() !== 'ALL') {
        where.status = statusParam.toUpperCase();
      } else if (!statusParam && !isAdmin) {
        where.status = 'ACTIVE';
      }

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { tags: { contains: search } },
          { sku: { contains: search } },
        ];
      }

      if (category) {
        where.category = {
          OR: [{ slug: category }, { id: category }, { name: { contains: category } }],
        };
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.discountPrice = {};
        if (minPrice !== undefined) where.discountPrice.gte = minPrice;
        if (maxPrice !== undefined) where.discountPrice.lte = maxPrice;
      }

      if (inStock) where.stock = { gt: 0 };
      if (featured) where.isFeatured = true;
      if (bestseller) where.isBestseller = true;

      let orderBy: any = { createdAt: 'desc' };
      if (sort === 'price-asc') orderBy = { price: 'asc' };
      else if (sort === 'price-desc') orderBy = { price: 'desc' };
      else if (sort === 'bestseller') orderBy = [{ isBestseller: 'desc' }, { createdAt: 'desc' }];
      else if (sort === 'popular') orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];

      const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            category: true,
            images: { orderBy: { sortOrder: 'asc' } },
            attributes: true,
            reviews: { select: { rating: true } },
          },
        }),
      ]);

      const formattedProducts = products.map((p) => {
        const avgRating =
          p.reviews.length > 0
            ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / p.reviews.length
            : 5;

        return {
          ...p,
          rating: Math.round(avgRating * 10) / 10,
          reviewsCount: p.reviews.length,
        };
      });

      return res.json({
        success: true,
        data: {
          products: formattedProducts,
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

  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await prisma.product.findFirst({
        where: { OR: [{ id }, { slug: id }] },
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
          attributes: true,
          reviews: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' } },
          inventory: true,
        },
      });

      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const avgRating =
        product.reviews.length > 0
          ? product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length
          : 5;

      return res.json({
        success: true,
        data: {
          ...product,
          rating: Math.round(avgRating * 10) / 10,
          reviewsCount: product.reviews.length,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        shortDescription,
        categoryId,
        price,
        discountPrice,
        sku,
        stock,
        lowStockThreshold,
        isFeatured,
        isBestseller,
        tags,
        images,
        attributes,
      } = req.body;

      if (!name || !categoryId || price === undefined || !sku) {
        return res.status(400).json({ success: false, message: 'Name, Category, Price, and SKU are required' });
      }

      const existingSku = await prisma.product.findUnique({
        where: { sku: sku.trim().toUpperCase() },
      });

      if (existingSku) {
        return res.status(400).json({ success: false, message: 'A product with this SKU already exists' });
      }

      const slug = slugify(name) + '-' + Math.floor(100 + Math.random() * 900);
      const numPrice = Number(price);
      const numDiscount = discountPrice ? Number(discountPrice) : numPrice;
      const numStock = Number(stock) || 0;
      const numLowStock = Number(lowStockThreshold) || 5;

      const product = await prisma.product.create({
        data: {
          name: name.trim(),
          slug,
          description: description || '',
          shortDescription: shortDescription || '',
          categoryId,
          price: numPrice,
          discountPrice: numDiscount,
          sku: sku.trim().toUpperCase(),
          stock: numStock,
          lowStockThreshold: numLowStock,
          status: 'ACTIVE',
          isFeatured: Boolean(isFeatured),
          isBestseller: Boolean(isBestseller),
          tags: tags || '',
          images: {
            create: (images || []).map((img: any, idx: number) => ({
              url: typeof img === 'string' ? img : img.url,
              altText: `${name} image`,
              isPrimary: idx === 0,
              sortOrder: idx,
            })),
          },
          attributes: {
            create: (attributes || []).map((attr: any) => ({
              name: attr.name,
              value: attr.value,
            })),
          },
          inventory: {
            create: {
              currentStock: numStock,
              reservedStock: 0,
              lowStockAlert: numStock <= numLowStock,
            },
          },
          inventoryLogs: {
            create: {
              type: 'RESTOCK',
              quantityChange: numStock,
              previousStock: 0,
              newStock: numStock,
              referenceId: 'ADMIN_CREATE',
              notes: 'Product created by administrator',
            },
          },
        },
        include: { category: true, images: true, attributes: true },
      });

      return res.status(201).json({ success: true, message: 'Product created successfully', data: product });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const {
        name,
        description,
        shortDescription,
        categoryId,
        price,
        discountPrice,
        sku,
        stock,
        lowStockThreshold,
        status,
        isFeatured,
        isBestseller,
        tags,
      } = req.body;

      const numStock = stock !== undefined ? Number(stock) : existing.stock;
      const stockDiff = numStock - existing.stock;

      const updated = await prisma.product.update({
        where: { id },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description }),
          ...(shortDescription !== undefined && { shortDescription }),
          ...(categoryId && { categoryId }),
          ...(price !== undefined && { price: Number(price) }),
          ...(discountPrice !== undefined && { discountPrice: Number(discountPrice) }),
          ...(sku && { sku: sku.trim().toUpperCase() }),
          ...(stock !== undefined && { stock: numStock }),
          ...(lowStockThreshold !== undefined && { lowStockThreshold: Number(lowStockThreshold) }),
          ...(status && { status }),
          ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured) }),
          ...(isBestseller !== undefined && { isBestseller: Boolean(isBestseller) }),
          ...(tags !== undefined && { tags }),
        },
        include: { category: true, images: true, attributes: true },
      });

      if (stockDiff !== 0) {
        await prisma.inventory.upsert({
          where: { productId: id },
          create: {
            productId: id,
            currentStock: numStock,
            lowStockAlert: numStock <= (updated.lowStockThreshold || 5),
          },
          update: {
            currentStock: numStock,
            lowStockAlert: numStock <= (updated.lowStockThreshold || 5),
          },
        });

        await prisma.inventoryTransaction.create({
          data: {
            productId: id,
            type: stockDiff > 0 ? 'RESTOCK' : 'ADJUSTMENT',
            quantityChange: stockDiff,
            previousStock: existing.stock,
            newStock: numStock,
            referenceId: 'ADMIN_UPDATE',
            notes: 'Stock updated by admin',
          },
        });
      }

      return res.json({ success: true, message: 'Product updated successfully', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.product.delete({ where: { id } });
      return res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
