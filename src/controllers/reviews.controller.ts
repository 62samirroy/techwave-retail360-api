import { Request, Response } from 'express';
import prisma from '../lib/db';
import { AuthenticatedRequest } from '../types';

export class ReviewsController {
  static async getByProduct(req: Request, res: Response) {
    try {
      const productId = req.query.productId as string;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product ID is required' });
      }

      const reviews = await prisma.review.findMany({
        where: { productId, status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
      });

      return res.json({ success: true, data: reviews });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { productId, rating, comment, userName } = req.body;
      if (!productId || !rating || !comment) {
        return res.status(400).json({ success: false, message: 'Product ID, rating (1-5), and review text are required' });
      }

      const review = await prisma.review.create({
        data: {
          productId,
          userId: req.user?.id || null,
          userName: userName?.trim() || req.user?.name || 'Verified Customer',
          rating: Math.max(1, Math.min(5, Number(rating))),
          comment: comment.trim(),
          isVerifiedPurchase: true,
          status: 'APPROVED',
        },
      });

      return res.status(201).json({ success: true, message: 'Review submitted successfully', data: review });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
