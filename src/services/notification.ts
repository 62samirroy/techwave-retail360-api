import prisma from '../lib/db';
import { buildWhatsAppLink } from '../lib/utils';

export class NotificationService {
  static async createNotification(params: {
    userId?: string | null;
    title: string;
    message: string;
    type: 'ORDER' | 'PAYMENT' | 'INVENTORY' | 'SYSTEM';
    link?: string;
  }) {
    try {
      return await prisma.notification.create({
        data: {
          userId: params.userId || null,
          title: params.title,
          message: params.message,
          type: params.type,
          link: params.link,
          isRead: false,
        },
      });
    } catch (e) {
      console.error('Failed to create in-app notification:', e);
      return null;
    }
  }

  static getOrderWhatsAppLink(order: {
    orderNumber: string;
    customerName: string;
    total: number;
    shippingAddress: string;
  }): string {
    const text = `Namaste ${order.customerName}! 🌸\n\nThank you for shopping at *Royal Saree & Fashion* (TechWave Retail360).\n\nYour Order *#${order.orderNumber}* for *₹${order.total.toLocaleString('en-IN')}* has been confirmed!\n\n📍 Delivery to: ${order.shippingAddress}\n\nOur artisans are now packing your saree with utmost care. You can track your order live or reach us here for any queries.`;
    return buildWhatsAppLink(text);
  }
}
