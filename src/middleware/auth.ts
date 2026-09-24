import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { verifyToken, AUTH_COOKIE_NAME } from '../lib/auth';
import prisma from '../lib/db';

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    token = req.cookies[AUTH_COOKIE_NAME];
  }

  if (!token) {
    return next();
  }

  const session = verifyToken(token);
  if (!session) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'CUSTOMER' | 'ADMIN',
        phone: user.phone,
      };
    }
  } catch (err) {
    // Proceed without user
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access forbidden. Administrator privileges required.',
    });
  }
  next();
}
