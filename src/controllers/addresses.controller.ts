import { Response } from 'express';
import prisma from '../lib/db';
import { AuthenticatedRequest } from '../types';

export class AddressesController {
  static async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const addresses = await prisma.address.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return res.json({ success: true, data: addresses });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { name, phone, streetAddress, city, state, pinCode, country = 'India', isDefault = false } = req.body;

      if (!name || !phone || !streetAddress || !city || !state || !pinCode) {
        return res.status(400).json({ success: false, message: 'All address fields are required.' });
      }

      // If set as default, reset other addresses of this user
      if (isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false },
        });
      }

      // Check if user has any existing addresses; if none, make this default
      const count = await prisma.address.count({ where: { userId: req.user.id } });
      const shouldBeDefault = isDefault || count === 0;

      const address = await prisma.address.create({
        data: {
          userId: req.user.id,
          name: name.trim(),
          phone: phone.trim(),
          streetAddress: streetAddress.trim(),
          city: city.trim(),
          state: state.trim(),
          pinCode: pinCode.trim(),
          country: country.trim(),
          isDefault: shouldBeDefault,
        },
      });

      return res.status(201).json({ success: true, message: 'Address saved successfully', data: address });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async update(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { id } = req.params;
      const { name, phone, streetAddress, city, state, pinCode, country, isDefault } = req.body;

      const existing = await prisma.address.findFirst({
        where: { id, userId: req.user.id },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Address not found or unauthorized' });
      }

      if (isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.user.id, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const updated = await prisma.address.update({
        where: { id },
        data: {
          ...(name && { name: name.trim() }),
          ...(phone && { phone: phone.trim() }),
          ...(streetAddress && { streetAddress: streetAddress.trim() }),
          ...(city && { city: city.trim() }),
          ...(state && { state: state.trim() }),
          ...(pinCode && { pinCode: pinCode.trim() }),
          ...(country && { country: country.trim() }),
          ...(isDefault !== undefined && { isDefault: Boolean(isDefault) }),
        },
      });

      return res.json({ success: true, message: 'Address updated successfully', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { id } = req.params;

      const existing = await prisma.address.findFirst({
        where: { id, userId: req.user.id },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Address not found or unauthorized' });
      }

      await prisma.address.delete({ where: { id } });

      // If deleted address was default, make the most recently updated one default
      if (existing.isDefault) {
        const remaining = await prisma.address.findFirst({
          where: { userId: req.user.id },
          orderBy: { updatedAt: 'desc' },
        });
        if (remaining) {
          await prisma.address.update({
            where: { id: remaining.id },
            data: { isDefault: true },
          });
        }
      }

      return res.json({ success: true, message: 'Address deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async setDefault(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { id } = req.params;

      const existing = await prisma.address.findFirst({
        where: { id, userId: req.user.id },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Address not found or unauthorized' });
      }

      await prisma.address.updateMany({
        where: { userId: req.user.id },
        data: { isDefault: false },
      });

      const updated = await prisma.address.update({
        where: { id },
        data: { isDefault: true },
      });

      return res.json({ success: true, message: 'Default address updated', data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
