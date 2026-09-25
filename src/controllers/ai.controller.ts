import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { AIService } from '../services/ai';
import prisma from '../lib/db';

export class AIController {
  static async customerChat(req: AuthenticatedRequest, res: Response) {
    try {
      const { message, conversationId, history = [] } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' });
      }

      if (message.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Message is too long. Please keep your query under 2,000 characters.',
        });
      }

      // Sanitize and bound history to recent 10 messages
      const sanitizedHistory = Array.isArray(history)
        ? history
            .slice(-10)
            .filter((h) => h && typeof h === 'object' && typeof h.content === 'string')
            .map((h) => ({
              role: (h.role === 'assistant' || h.role === 'system' ? h.role : 'user') as 'user' | 'assistant' | 'system',
              content: String(h.content).substring(0, 2000),
            }))
        : [];

      const aiResult = await AIService.handleCustomerChat(message.trim(), sanitizedHistory, req.user);

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
            { conversationId: convId, sender: 'USER', content: message.trim() },
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
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' });
      }

      if (message.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Query is too long. Please keep your question under 2,000 characters.',
        });
      }

      const aiResult = await AIService.handleBusinessChat(message.trim());

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
