import { Response } from 'express';
import prisma from '../lib/db';
import { AuthenticatedRequest } from '../types';

const CART_SESSION_COOKIE = 'tw_cart_session';

async function getOrCreateCart(req: AuthenticatedRequest, res: Response) {
  const session = req.user;
  let sessionId = req.cookies ? req.cookies[CART_SESSION_COOKIE] : undefined;

  if (session) {
    let cart = await prisma.cart.findUnique({
      where: { userId: session.id },
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

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: session.id },
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
    }

    return { cart, sessionId: null };
  } else {
    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      res.cookie(CART_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    let cart = await prisma.cart.findUnique({
      where: { sessionId },
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

    if (!cart) {
      cart = await prisma.cart.create({
        data: { sessionId },
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
    }

    return { cart, sessionId };
  }
}

export class CartController {
  static async getCart(req: AuthenticatedRequest, res: Response) {
    try {
      const { cart } = await getOrCreateCart(req, res);

      let subtotal = 0;
      const validatedItems = cart.items.map((item) => {
        const price = item.product.discountPrice || item.product.price;
        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        return {
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price,
          itemTotal,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            sku: item.product.sku,
            stock: item.product.stock,
            price: item.product.price,
            discountPrice: item.product.discountPrice,
            image: item.product.images[0]?.url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=400',
            category: item.product.category.name,
          },
        };
      });

      const freeShippingThreshold = 1999;
      const standardShippingFee = 99;
      const shippingFee = subtotal >= freeShippingThreshold || subtotal === 0 ? 0 : standardShippingFee;
      const tax = Math.round(subtotal * 0.05); // 5% GST
      const grandTotal = subtotal + shippingFee + tax;

      return res.json({
        success: true,
        data: {
          id: cart.id,
          items: validatedItems,
          itemCount: validatedItems.reduce((acc, it) => acc + it.quantity, 0),
          subtotal,
          shippingFee,
          tax,
          grandTotal,
          freeShippingThreshold,
          freeShippingRemaining: Math.max(0, freeShippingThreshold - subtotal),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async addItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { productId, quantity = 1 } = req.body;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product ID is required' });
      }

      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || product.status !== 'ACTIVE') {
        return res.status(404).json({ success: false, message: 'Product is unavailable' });
      }

      if (product.stock <= 0) {
        return res.status(400).json({ success: false, message: 'This saree is out of stock' });
      }

      const { cart } = await getOrCreateCart(req, res);

      const existingItem = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
      });

      const newQuantity = (existingItem?.quantity || 0) + Number(quantity);
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} units available in stock.`,
        });
      }

      const price = product.discountPrice || product.price;

      await prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: { cartId: cart.id, productId, quantity: Math.max(1, Number(quantity)), price },
        update: { quantity: newQuantity, price },
      });

      return res.json({ success: true, message: 'Added to cart successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { itemId } = req.params;
      const { quantity } = req.body;
      const numQuantity = Number(quantity);

      const { cart } = await getOrCreateCart(req, res);

      const cartItem = await prisma.cartItem.findUnique({
        where: { id: itemId },
        include: { product: true },
      });

      if (!cartItem || cartItem.cartId !== cart.id) {
        return res.status(404).json({ success: false, message: 'Item not found in your cart' });
      }

      if (isNaN(numQuantity) || numQuantity <= 0) {
        await prisma.cartItem.delete({ where: { id: itemId } });
        return res.json({ success: true, message: 'Item removed from cart' });
      }

      if (numQuantity > cartItem.product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${cartItem.product.stock} units available in stock.`,
        });
      }

      const updated = await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: numQuantity },
      });

      return res.json({ success: true, message: 'Cart updated successfully', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async removeItem(req: AuthenticatedRequest, res: Response) {
    try {
      const { itemId } = req.params;
      const { cart } = await getOrCreateCart(req, res);

      const cartItem = await prisma.cartItem.findUnique({
        where: { id: itemId },
      });

      if (!cartItem || cartItem.cartId !== cart.id) {
        return res.status(404).json({ success: false, message: 'Item not found in your cart' });
      }

      await prisma.cartItem.delete({ where: { id: itemId } });
      return res.json({ success: true, message: 'Item removed from cart' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async clearCart(req: AuthenticatedRequest, res: Response) {
    try {
      const { cart } = await getOrCreateCart(req, res);
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      return res.json({ success: true, message: 'Cart cleared successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
