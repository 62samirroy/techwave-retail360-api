import { Request, Response } from 'express';
import prisma from '../lib/db';
import { comparePassword, hashPassword, signToken, AUTH_COOKIE_NAME } from '../lib/auth';
import { AuthenticatedRequest } from '../types';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'CUSTOMER' | 'ADMIN',
        phone: user.phone,
      };

      const token = signToken(sessionUser);

      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        message: 'Login successful',
        data: { user: sessionUser, token },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const { name, email, password, phone } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : null,
          passwordHash,
          role: 'CUSTOMER',
          profile: { create: {} },
          cart: { create: {} },
          wishlist: { create: {} },
        },
      });

      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'CUSTOMER' | 'ADMIN',
        phone: user.phone,
      };

      const token = signToken(sessionUser);

      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: { user: sessionUser, token },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated', data: null });
    }
    return res.json({ success: true, data: { user: req.user } });
  }

  static async logout(req: Request, res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.json({ success: true, message: 'Logged out successfully' });
  }
}
