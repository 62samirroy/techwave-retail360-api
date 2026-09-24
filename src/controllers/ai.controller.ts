import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { AIService } from '../services/ai';
import prisma from '../lib/db';

export class AIController {
  static async customerChat(req: AuthenticatedRequest, res: Response) {
    try {
      const { message, conversationId, history = [] } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, message: 'Message text is required' });
      }

      const aiResult = await AIService.handleCustomerChat(message, history);

      let convId = conversationId;
      try {
        if (!convId) {
          const newConv = await prisma.aiConversation.create({
            data: { userId: req.user?.id || null, role: 'CUSTOMER' },
          });
          convId = newConv.id;
        }

        await prisma.aiMessage.createMany({
          data: [
            { conversationId: convId, sender: 'USER', content: message },
            {
              conversationId: convId,
              sender: 'ASSISTANT',
              content: aiResult.content,
              metadataJson: aiResult.metadata ? JSON.stringify(aiResult.metadata) : null,
            },
          ],
        });
      } catch (e) {}

      return res.json({
        success: true,
        data: {
          conversationId: convId,
          message: aiResult.content,
          metadata: aiResult.metadata,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async businessChat(req: AuthenticatedRequest, res: Response) {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, message: 'Message text is required' });
      }

      const aiResult = await AIService.handleBusinessChat(message);

      return res.json({
        success: true,
        data: {
          message: aiResult.content,
          metadata: aiResult.metadata,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
