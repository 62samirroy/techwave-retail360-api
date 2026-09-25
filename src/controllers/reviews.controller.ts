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

  /**
   * Check if current user is eligible to review a product
   */
  static async checkEligibility(req: AuthenticatedRequest, res: Response) {
    try {
      const productId = req.query.productId as string;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product ID is required' });
      }

      if (!req.user) {
        return res.json({
          success: true,
          data: {
            isLoggedIn: false,
            hasPurchased: false,
            canReview: false,
            existingReview: null,
            message: 'Sign in to review products you purchased',
          },
        });
      }

      // Check for purchased orders
      const userOrders = await prisma.order.findMany({
        where: {
          OR: [
            { userId: req.user.id },
            { customerEmail: req.user.email },
            ...(req.user.phone ? [{ customerPhone: req.user.phone }] : []),
          ],
          paymentStatus: 'PAID',
          status: { not: 'CANCELLED' },
        },
        include: { items: true },
      });

      const hasPurchased = userOrders.some((order) =>
        order.items.some((item) => item.productId === productId)
      );

      const existingReview = await prisma.review.findFirst({
        where: { productId, userId: req.user.id },
      });

      return res.json({
        success: true,
        data: {
          isLoggedIn: true,
          hasPurchased,
          canReview: hasPurchased,
          existingReview,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required. Please sign in to submit a review.' });
      }

      const { productId, rating, comment, userName } = req.body;
      if (!productId || !rating || !comment) {
        return res.status(400).json({ success: false, message: 'Product ID, rating (1-5), and review text are required' });
      }

      // Verify that the customer has actually purchased this product
      const userOrders = await prisma.order.findMany({
        where: {
          OR: [
            { userId: req.user.id },
            { customerEmail: req.user.email },
            ...(req.user.phone ? [{ customerPhone: req.user.phone }] : []),
          ],
          paymentStatus: 'PAID',
          status: { not: 'CANCELLED' },
        },
        include: { items: true },
      });

      const hasPurchased = userOrders.some((order) =>
        order.items.some((item) => item.productId === productId)
      );

      if (!hasPurchased && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only verified customers who have completed a purchase of this saree can submit a review.',
        });
      }

      // Check for existing review by this user on this product to prevent duplicate reviews
      const existing = await prisma.review.findFirst({
        where: { productId, userId: req.user.id },
      });

      if (existing) {
        // Update existing review
        const updated = await prisma.review.update({
          where: { id: existing.id },
          data: {
            rating: Math.max(1, Math.min(5, Number(rating))),
            comment: comment.trim(),
            userName: userName?.trim() || req.user.name,
            isVerifiedPurchase: true,
            status: 'APPROVED',
          },
        });
        return res.json({
          success: true,
          message: 'Your existing review has been updated successfully',
          data: updated,
        });
      }

      const review = await prisma.review.create({
        data: {
          productId,
          userId: req.user.id,
          userName: userName?.trim() || req.user.name || 'Verified Customer',
          rating: Math.max(1, Math.min(5, Number(rating))),
          comment: comment.trim(),
          isVerifiedPurchase: true,
          status: 'APPROVED',
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Review submitted and verified successfully',
        data: review,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Admin Review Moderation
  static async getAllAdmin(req: AuthenticatedRequest, res: Response) {
    try {
      const status = req.query.status as string;
      const where: any = {};
      if (status) where.status = status;

      const reviews = await prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, slug: true } } },
      });

      return res.json({ success: true, data: reviews });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['APPROVED', 'PENDING', 'REJECTED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Valid status is required (APPROVED, PENDING, REJECTED)' });
      }

      const updated = await prisma.review.update({
        where: { id },
        data: { status },
      });

      return res.json({ success: true, message: 'Review status updated', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await prisma.review.delete({ where: { id } });
      return res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
