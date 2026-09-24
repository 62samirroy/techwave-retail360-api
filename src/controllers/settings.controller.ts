import { Request, Response } from 'express';
import prisma from '../lib/db';

export class SettingsController {
  static async getSettings(req: Request, res: Response) {
    try {
      const settings = await prisma.setting.findMany();
      const settingsMap: Record<string, string> = {};
      settings.forEach((s) => {
        settingsMap[s.key] = s.value;
      });

      return res.json({ success: true, data: settingsMap });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateSettings(req: Request, res: Response) {
    try {
      const body = req.body;
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string' || typeof value === 'number') {
          await prisma.setting.upsert({
            where: { key },
            create: { key, value: String(value) },
            update: { value: String(value) },
          });
        }
      }
      return res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
