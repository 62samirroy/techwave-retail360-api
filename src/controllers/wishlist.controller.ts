import { Response } from 'express';
import prisma from '../lib/db';
import { AuthenticatedRequest } from '../types';

export class WishlistController {
  static async getWishlist(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.json({ success: true, data: [] });
      }

      const wishlist = await prisma.wishlist.findUnique({
        where: { userId: req.user.id },
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
        },
      });

      return res.json({ success: true, data: wishlist?.items || [] });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async toggle(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Please sign in to save items to your wishlist' });
      }

      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product ID is required' });
      }

      let wishlist = await prisma.wishlist.findUnique({
        where: { userId: req.user.id },
      });

      if (!wishlist) {
        wishlist = await prisma.wishlist.create({
          data: { userId: req.user.id },
        });
      }

      const existing = await prisma.wishlistItem.findUnique({
        where: {
          wishlistId_productId: {
            wishlistId: wishlist.id,
            productId,
          },
        },
      });

      if (existing) {
        await prisma.wishlistItem.delete({ where: { id: existing.id } });
        return res.json({ success: true, message: 'Removed from wishlist', isWishlisted: false });
      } else {
        await prisma.wishlistItem.create({
          data: { wishlistId: wishlist.id, productId },
        });
        return res.json({ success: true, message: 'Saved to wishlist', isWishlisted: true });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
