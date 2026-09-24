import prisma from '../lib/db';
import { formatPrice } from '../lib/utils';

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  metadata?: {
    type?: 'products' | 'order' | 'analytics' | 'faq';
    items?: any[];
    stats?: any;
    link?: string;
  };
}

export class AITools {
  static async searchProducts(params: {
    keyword?: string;
    maxPrice?: number;
    color?: string;
    fabric?: string;
    category?: string;
    inStockOnly?: boolean;
    limit?: number;
  }) {
    const where: any = {
      status: 'ACTIVE',
    };

    if (params.inStockOnly) {
      where.stock = { gt: 0 };
    }

    if (params.maxPrice) {
      where.discountPrice = { lte: params.maxPrice };
    }

    const searchTerms: any[] = [];
    if (params.keyword) {
      searchTerms.push(
        { name: { contains: params.keyword } },
        { description: { contains: params.keyword } },
        { tags: { contains: params.keyword } }
      );
    }

    if (params.color) {
      searchTerms.push(
        { name: { contains: params.color } },
        { tags: { contains: params.color } }
      );
    }

    if (params.fabric) {
      searchTerms.push(
        { name: { contains: params.fabric } },
        { tags: { contains: params.fabric } }
      );
    }

    if (searchTerms.length > 0) {
      where.OR = searchTerms;
    }

    if (params.category) {
      where.category = {
        name: { contains: params.category },
      };
    }

    const products = await prisma.product.findMany({
      where,
      take: params.limit || 4,
      include: {
        category: true,
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        attributes: true,
      },
      orderBy: { price: 'asc' },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.discountPrice || p.price,
      originalPrice: p.price,
      stock: p.stock,
      category: p.category.name,
      image: p.images[0]?.url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=400',
    }));
  }

  static async lookupOrderStatus(orderNumber: string, identifier?: string) {
    const cleanNumber = orderNumber.trim().toUpperCase();
    return await prisma.order.findFirst({
      where: {
        orderNumber: cleanNumber,
        ...(identifier ? {
          OR: [
            { customerEmail: { contains: identifier.trim() } },
            { customerPhone: { contains: identifier.trim() } },
          ],
        } : {}),
      },
      select: {
        orderNumber: true,
        customerName: true,
        status: true,
        paymentStatus: true,
        total: true,
        carrier: true,
        trackingNumber: true,
        createdAt: true,
        city: true,
      },
    });
  }

  static async getBusinessMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalOrders,
      todayOrders,
      monthOrders,
      pendingOrders,
      lowStockProducts,
      totalCustomers,
    ] = await Promise.all([
      prisma.order.findMany({ select: { total: true, paymentStatus: true } }),
      prisma.order.findMany({
        where: { createdAt: { gte: today } },
        select: { total: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: firstDayOfMonth } },
        select: { total: true },
      }),
      prisma.order.count({
        where: { status: { in: ['PENDING', 'PROCESSING', 'CONFIRMED'] } },
      }),
      prisma.product.findMany({
        where: {
          stock: { lte: 5 },
          status: 'ACTIVE',
        },
        select: { id: true, name: true, sku: true, stock: true },
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
    ]);

    const totalRevenue = totalOrders
      .filter((o) => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.total, 0);

    const todaySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const monthSales = monthOrders.reduce((sum, o) => sum + o.total, 0);

    return {
      totalRevenue,
      todaySales,
      monthSales,
      totalOrdersCount: totalOrders.length,
      todayOrdersCount: todayOrders.length,
      pendingOrdersCount: pendingOrders,
      lowStockCount: lowStockProducts.length,
      lowStockItems: lowStockProducts,
      totalCustomersCount: totalCustomers,
    };
  }

  static async getTopSellingProducts(limit = 5) {
    const orderItems = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    return orderItems.map((item) => ({
      name: item.productName,
      unitsSold: item._sum.quantity || 0,
      totalRevenue: item._sum.total || 0,
    }));
  }
}

export class RuleBasedAIEngine {
  static async processCustomerQuery(query: string, history: AIChatMessage[] = []): Promise<AIResponse> {
    const q = query.toLowerCase();

    // 1. Order Status Check
    const orderMatch = query.match(/(?:TW-ORD-)?(\d{5})/i) || query.match(/tw-ord-\d{5}/i);
    if (q.includes('order') || q.includes('track') || q.includes('status') || orderMatch) {
      if (orderMatch) {
        const fullNumber = orderMatch[0].toUpperCase().startsWith('TW-ORD-')
          ? orderMatch[0].toUpperCase()
          : `TW-ORD-${orderMatch[1]}`;

        const order = await AITools.lookupOrderStatus(fullNumber);
        if (order) {
          return {
            content: `I found your Order #${order.orderNumber} for ${order.customerName}.\n\n` +
              `• Current Status: **${order.status}**\n` +
              `• Payment: **${order.paymentStatus}** (Total: ${formatPrice(order.total)})\n` +
              `• Shipping To: **${order.city}** via ${order.carrier || 'Express Courier'}\n` +
              (order.trackingNumber ? `• Tracking Number: \`${order.trackingNumber}\`\n\n` : '\n') +
              `Our packaging team takes personal care of every saree. You can also view real-time tracking on our Track Order page!`,
            metadata: {
              type: 'order',
              items: [order],
              link: `/track-order?orderId=${order.orderNumber}`,
            },
          };
        } else {
          return {
            content: `I searched for Order #${fullNumber}, but couldn't locate it. Please double-check your 5-digit Order ID (e.g. TW-ORD-10021) or provide your email/phone so I can find it for you!`,
          };
        }
      } else {
        return {
          content: `I can certainly check your order status! Please provide your 5-digit Order Number (e.g., **TW-ORD-10021**) or your registered phone number.`,
        };
      }
    }

    // 2. Price or Color/Fabric search: "Do you have red sarees under 3000?", "Kanjivaram under 15000"
    const priceMatch = q.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) ||
                       q.match(/(?:₹|rs\.?|inr)\s*(\d+)/i);
    const maxPrice = priceMatch ? parseInt(priceMatch[1], 10) : undefined;

    const colors = ['red', 'crimson', 'blue', 'navy', 'green', 'emerald', 'yellow', 'pink', 'black', 'peach', 'orange', 'lavender', 'mint', 'ivory', 'gold'];
    const matchedColor = colors.find((c) => q.includes(c));

    const fabrics = ['kanjivaram', 'banarasi', 'organza', 'chanderi', 'linen', 'bandhani', 'leheriya', 'sequin', 'silk', 'georgette', 'tissue'];
    const matchedFabric = fabrics.find((f) => q.includes(f));

    if (maxPrice || matchedColor || matchedFabric || q.includes('saree') || q.includes('collection') || q.includes('recommend') || q.includes('show me')) {
      const products = await AITools.searchProducts({
        maxPrice,
        color: matchedColor,
        fabric: matchedFabric,
        inStockOnly: true,
        limit: 4,
      });

      if (products.length > 0) {
        let intro = `Here are exquisite authentic sarees matching your request`;
        if (matchedColor) intro += ` in **${matchedColor}**`;
        if (matchedFabric) intro += ` crafted in **${matchedFabric}**`;
        if (maxPrice) intro += ` under **${formatPrice(maxPrice)}**`;
        intro += `:\n`;

        return {
          content: `${intro}\nEach saree comes certified with authentic handloom hallmark, pure weave guarantee, and complimentary unstitched blouse piece. Tap any item below to view detailed drape photos!`,
          metadata: {
            type: 'products',
            items: products,
          },
        };
      } else {
        const featured = await AITools.searchProducts({ limit: 3 });
        return {
          content: `We don't have an exact match for "${query}" right now, but here are our most beloved bestselling heritage pieces:`,
          metadata: {
            type: 'products',
            items: featured,
          },
        };
      }
    }

    // 3. Shipping / Delivery queries
    if (q.includes('shipping') || q.includes('delivery') || q.includes('how long') || q.includes('dispatch') || q.includes('courier')) {
      return {
        content: `📦 **Shipping & Delivery Information:**\n\n` +
          `• **Free Express Shipping** on all orders above **₹1,999**!\n` +
          `• Standard delivery fee: **₹99** across all Indian PIN codes.\n` +
          `• Metro cities: Delivered within **2 to 4 business days**.\n` +
          `• Rest of India: Delivered within **4 to 6 business days**.\n` +
          `• We partner with Blue Dart, DTDC, and Delhivery for tamper-evident insured delivery with live SMS tracking.`,
        metadata: { type: 'faq' },
      };
    }

    // 4. Return / Refund Policy
    if (q.includes('return') || q.includes('refund') || q.includes('exchange') || q.includes('cancel')) {
      return {
        content: `🔄 **7-Day Hassle-Free Returns & Exchange:**\n\n` +
          `• We offer a **7-day return policy** from the date of delivery.\n` +
          `• The saree must remain unused with original security tags, fabric fold, and invoice intact.\n` +
          `• Doorstep reverse pickup is arranged free of charge.\n` +
          `• Full refund is credited directly to your original bank/UPI account within 24-48 hours of inspection.`,
        metadata: { type: 'faq' },
      };
    }

    // 5. Store / Contact Info
    if (q.includes('contact') || q.includes('phone') || q.includes('email') || q.includes('address') || q.includes('store')) {
      return {
        content: `🏛️ **Royal Saree & Fashion** by TechWave Solutions\n\n` +
          `• 📞 **Direct Phone:** +91 9641145871\n` +
          `• 💬 **WhatsApp:** +919641145871\n` +
          `• ✉️ **Email:** techwavesolutions.dev@gmail.com\n` +
          `• 📍 **Headquarters:** TechWave Tower, Sector V, Salt Lake, Kolkata 700091\n` +
          `• Operating Hours: Mon-Sat, 10:00 AM – 8:00 PM IST`,
        metadata: { type: 'faq' },
      };
    }

    return {
      content: `Namaste! Welcome to **Royal Saree & Fashion**.\n\nI can help you with:\n` +
        `• Finding the perfect saree (*e.g., "Show me red bridal Kanjivaram" or "Organza under ₹5000"*)\n` +
        `• Live order tracking (*e.g., "Where is my order TW-ORD-10021?"*)\n` +
        `• Fabric details, zari purity, and styling guidance\n` +
        `• Shipping fees and 7-day return guarantee\n\nHow may I assist your celebration today?`,
    };
  }

  static async processBusinessQuery(query: string): Promise<AIResponse> {
    const q = query.toLowerCase();

    if (q.includes('today') || q.includes('sales') || q.includes('revenue') || q.includes('turnover') || q.includes('earning')) {
      const metrics = await AITools.getBusinessMetrics();
      return {
        content: `📊 **Financial & Sales Overview:**\n\n` +
          `• **Today's Sales:** **${formatPrice(metrics.todaySales)}** (${metrics.todayOrdersCount} orders today)\n` +
          `• **This Month's Sales:** **${formatPrice(metrics.monthSales)}**\n` +
          `• **All-Time Revenue:** **${formatPrice(metrics.totalRevenue)}** across ${metrics.totalOrdersCount} verified orders\n` +
          `• **Pending Orders for Fulfillment:** **${metrics.pendingOrdersCount}** orders\n` +
          `• **Active Customer Base:** **${metrics.totalCustomersCount}** registered accounts`,
        metadata: {
          type: 'analytics',
          stats: metrics,
        },
      };
    }

    if (q.includes('stock') || q.includes('inventory') || q.includes('low') || q.includes('reorder')) {
      const metrics = await AITools.getBusinessMetrics();
      if (metrics.lowStockItems.length > 0) {
        let msg = `⚠️ **Low Stock Alert (${metrics.lowStockCount} items requiring reorder):**\n\n`;
        metrics.lowStockItems.forEach((p) => {
          msg += `• **${p.name}** (SKU: \`${p.sku}\`) — **Only ${p.stock} units left** (Threshold: 5)\n`;
        });
        msg += `\nRecommended action: Contact master weaver clusters to replenish stock.`;
        return {
          content: msg,
          metadata: {
            type: 'analytics',
            items: metrics.lowStockItems,
          },
        };
      } else {
        return {
          content: `✅ All active products are currently well-stocked above their respective low-stock alert thresholds!`,
        };
      }
    }

    if (q.includes('best') || q.includes('top') || q.includes('popular') || q.includes('highest')) {
      const topProducts = await AITools.getTopSellingProducts(5);
      let msg = `🏆 **Top Revenue Performing Products:**\n\n`;
      topProducts.forEach((item, idx) => {
        msg += `${idx + 1}. **${item.name}**\n   • Gross Revenue: **${formatPrice(item.totalRevenue)}** | Units Dispatched: **${item.unitsSold}**\n`;
      });
      return {
        content: msg,
        metadata: {
          type: 'analytics',
          items: topProducts,
        },
      };
    }

    return {
      content: `Hello Store Administrator. I am your **TechWave Retail360 Business Intelligence Assistant**.\n\nYou can ask me real-time questions such as:\n` +
        `• *"What are today's sales and revenue?"*\n` +
        `• *"Which products are low in stock?"*\n` +
        `• *"Show me the best-selling sarees by revenue"*\n` +
        `• *"How many pending orders need fulfillment?"*`,
    };
  }
}

export class AIService {
  static async handleCustomerChat(message: string, history: AIChatMessage[] = []): Promise<AIResponse> {
    return RuleBasedAIEngine.processCustomerQuery(message, history);
  }

  static async handleBusinessChat(message: string): Promise<AIResponse> {
    return RuleBasedAIEngine.processBusinessQuery(message);
  }
}
