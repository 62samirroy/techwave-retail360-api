import { Request, Response } from 'express';
import prisma from '../lib/db';
import { slugify } from '../lib/utils';

export class CategoriesController {
  static async getAll(req: Request, res: Response) {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { products: true } } },
      });
      return res.json({ success: true, data: categories });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { name, description, image, sortOrder } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }

      const slug = slugify(name);
      const existing = await prisma.category.findUnique({ where: { slug } });
      const finalSlug = existing ? `${slug}-${Math.floor(100 + Math.random() * 900)}` : slug;

      const category = await prisma.category.create({
        data: {
          name: name.trim(),
          slug: finalSlug,
          description: description || null,
          image: image || null,
          sortOrder: Number(sortOrder) || 0,
          status: 'ACTIVE',
        },
      });

      return res.status(201).json({ success: true, message: 'Category created successfully', data: category });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, image, status, sortOrder } = req.body;

      const updated = await prisma.category.update({
        where: { id },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description }),
          ...(image !== undefined && { image }),
          ...(status && { status }),
          ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
        },
      });

      return res.json({ success: true, message: 'Category updated successfully', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.category.delete({ where: { id } });
      return res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
