import { Request, Response } from 'express';
import prisma from '../lib/db';
import { AuthenticatedRequest } from '../types';

export class InquiriesController {
  static async getAll(req: Request, res: Response) {
    try {
      const status = req.query.status as string;
      const where: any = {};
      if (status) where.status = status;

      const inquiries = await prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, sku: true } } },
      });

      return res.json({ success: true, data: inquiries });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, email, phone, message, productId, inquiryType } = req.body;
      if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: 'Name, email, and message are required' });
      }

      const inquiry = await prisma.inquiry.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ? phone.trim() : null,
          message: message.trim(),
          productId: productId || null,
          userId: req.user?.id || null,
          inquiryType: inquiryType || 'GENERAL',
          status: 'NEW',
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Thank you! Your inquiry has been sent to our master consultants.',
        data: inquiry,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;

      const updated = await prisma.inquiry.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(adminNotes !== undefined && { adminNotes }),
        },
      });

      return res.json({ success: true, message: 'Inquiry updated successfully', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
