import prisma from '../lib/db';
import { formatPrice } from '../lib/utils';
import { UserSession } from '../types';

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
      where.OR = [
        { discountPrice: { lte: params.maxPrice } },
        { discountPrice: null, price: { lte: params.maxPrice } },
      ];
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

  static async checkProductAvailability(query: string) {
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { name: { contains: query } },
          { slug: { contains: query } },
          { sku: { contains: query } },
        ],
      },
      take: 3,
      include: { category: true, images: { where: { isPrimary: true }, take: 1 } },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      stock: p.stock,
      isAvailable: p.stock > 0,
      price: p.discountPrice || p.price,
      category: p.category.name,
      image: p.images[0]?.url,
    }));
  }

  static async getCategories() {
    return prisma.category.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  static async lookupCustomerOrders(user?: UserSession, orderNumber?: string, identifier?: string) {
    // If order number provided, verify ownership or identifier match
    if (orderNumber) {
      const cleanNumber = orderNumber.trim().toUpperCase();
      const where: any = { orderNumber: cleanNumber };

      if (user && user.role !== 'ADMIN') {
        where.OR = [
          { userId: user.id },
          { customerEmail: user.email },
          ...(user.phone ? [{ customerPhone: user.phone }] : []),
        ];
      } else if (!user && identifier) {
        where.OR = [
          { customerEmail: { contains: identifier.trim().toLowerCase() } },
          { customerPhone: { contains: identifier.trim() } },
        ];
      } else if (!user && !identifier) {
        // For unauthenticated users without identifier, return null to protect privacy
        return null;
      }

      return await prisma.order.findFirst({
        where,
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
          items: {
            select: { productName: true, quantity: true, unitPrice: true },
          },
        },
      });
    }

    // If user is authenticated, retrieve their latest orders
    if (user) {
      return await prisma.order.findMany({
        where: {
          OR: [
            { userId: user.id },
            { customerEmail: user.email },
            ...(user.phone ? [{ customerPhone: user.phone }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
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
          items: {
            select: { productName: true, quantity: true, unitPrice: true },
          },
        },
      });
    }

    return null;
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
      outOfStockProducts,
      totalCustomers,
      recentOrders,
    ] = await Promise.all([
      prisma.order.findMany({ select: { total: true, paymentStatus: true } }),
      prisma.order.findMany({
        where: { createdAt: { gte: today } },
        select: { total: true, customerEmail: true, customerPhone: true, paymentStatus: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: firstDayOfMonth } },
        select: { total: true, paymentStatus: true },
      }),
      prisma.order.count({
        where: { status: { in: ['PENDING', 'PROCESSING', 'CONFIRMED'] } },
      }),
      prisma.product.findMany({
        where: {
          stock: { lte: 5, gt: 0 },
          status: 'ACTIVE',
        },
        select: { id: true, name: true, sku: true, stock: true },
      }),
      prisma.product.findMany({
        where: {
          stock: { equals: 0 },
          status: 'ACTIVE',
        },
        select: { id: true, name: true, sku: true, stock: true },
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          orderNumber: true,
          customerName: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
    ]);

    const totalRevenue = totalOrders
      .filter((o) => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.total, 0);

    const todaySales = todayOrders
      .filter((o) => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.total, 0);

    const monthSales = monthOrders
      .filter((o) => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.total, 0);

    // Unique customers who ordered today
    const todayUniqueCustomers = new Set(
      todayOrders.map((o) => o.customerEmail || o.customerPhone).filter(Boolean)
    ).size;

    return {
      totalRevenue,
      todaySales,
      monthSales,
      totalOrdersCount: totalOrders.length,
      todayOrdersCount: todayOrders.length,
      todayCustomersCount: todayUniqueCustomers,
      pendingOrdersCount: pendingOrders,
      lowStockCount: lowStockProducts.length,
      lowStockItems: lowStockProducts,
      outOfStockCount: outOfStockProducts.length,
      outOfStockItems: outOfStockProducts,
      totalCustomersCount: totalCustomers,
      recentOrders,
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

  static async getTopCategories() {
    const categories = await prisma.category.findMany({
      where: { status: 'ACTIVE' },
      include: {
        products: {
          select: {
            id: true,
            orderItems: { select: { quantity: true, total: true } },
          },
        },
      },
    });

    const categoryStats = categories.map((cat) => {
      let totalUnits = 0;
      let totalRevenue = 0;
      cat.products.forEach((prod) => {
        prod.orderItems.forEach((oi) => {
          totalUnits += oi.quantity || 0;
          totalRevenue += oi.total || 0;
        });
      });
      return {
        name: cat.name,
        slug: cat.slug,
        unitsSold: totalUnits,
        revenue: totalRevenue,
      };
    });

    categoryStats.sort((a, b) => b.revenue - a.revenue);
    return categoryStats;
  }
}

export class RuleBasedAIEngine {
  static async processCustomerQuery(
    query: string,
    history: AIChatMessage[] = [],
    user?: UserSession
  ): Promise<AIResponse> {
    const q = query.toLowerCase();

    // 1. Order Status Check ("where is my order", "order status", "track order", specific TW-ORD-XXXX)
    const orderMatch = query.match(/(?:TW-ORD-)?(\d{5})/i) || query.match(/tw-ord-\d{5}/i);
    if (q.includes('order') || q.includes('track') || q.includes('where is my') || orderMatch) {
      if (orderMatch) {
        const fullNumber = orderMatch[0].toUpperCase().startsWith('TW-ORD-')
          ? orderMatch[0].toUpperCase()
          : `TW-ORD-${orderMatch[1]}`;

        const order: any = await AITools.lookupCustomerOrders(user, fullNumber);
        if (order) {
          return {
            content: `I found your Order #${order.orderNumber} for ${order.customerName}.\n\n` +
              `• Status: **${order.status}**\n` +
              `• Payment: **${order.paymentStatus}** (Total: ${formatPrice(order.total)})\n` +
              `• Shipping To: **${order.city}** via ${order.carrier || 'Express Courier'}\n` +
              (order.trackingNumber ? `• Tracking Number: \`${order.trackingNumber}\`\n\n` : '\n') +
              `You can track the shipment live on our Track Order page!`,
            metadata: {
              type: 'order',
              items: [order],
              link: `/track-order?orderId=${order.orderNumber}`,
            },
          };
        } else {
          return {
            content: `I could not locate Order #${fullNumber} under your verified session. If this is your order, please verify the order number or ensure you are signed in with the ordering email.`,
          };
        }
      } else if (user) {
        // Authenticated customer asking general order question
        const userOrders: any = await AITools.lookupCustomerOrders(user);
        if (Array.isArray(userOrders) && userOrders.length > 0) {
          const latest = userOrders[0];
          return {
            content: `Hello ${user.name}! Here is your latest order:\n\n` +
              `• Order #${latest.orderNumber} (${new Date(latest.createdAt).toLocaleDateString()})\n` +
              `• Status: **${latest.status}** | Total: **${formatPrice(latest.total)}**\n` +
              `• Delivery to: **${latest.city}** via ${latest.carrier || 'Express Courier'}\n\n` +
              `You have ${userOrders.length} total orders. Tap below to track this shipment!`,
            metadata: {
              type: 'order',
              items: [latest],
              link: `/track-order?orderId=${latest.orderNumber}`,
            },
          };
        } else {
          return {
            content: `Hello ${user.name}! You haven't placed any orders yet. Once you place an order, I can give you live tracking updates anytime right here!`,
          };
        }
      } else {
        return {
          content: `To check your order status, please provide your 5-digit Order Number (e.g., **TW-ORD-10021**) or sign in to view your orders automatically.`,
        };
      }
    }

    // 2. Product Availability Inquiry ("is this available", "in stock", "do you have kanjivaram")
    if (q.includes('available') || q.includes('in stock') || q.includes('out of stock')) {
      const matchWords = q.replace(/is|this|product|available|in|stock|out|of|do|you|have/gi, '').trim();
      if (matchWords.length >= 3) {
        const found = await AITools.checkProductAvailability(matchWords);
        if (found.length > 0) {
          let msg = `Here is the current inventory availability:\n\n`;
          found.forEach((p) => {
            msg += `• **${p.name}** (SKU: \`${p.sku}\`)\n` +
              `  Status: **${p.isAvailable ? `In Stock (${p.stock} units available)` : 'Currently Out of Stock'}**\n` +
              `  Price: **${formatPrice(p.price)}**\n`;
          });
          return {
            content: msg,
            metadata: { type: 'products', items: found },
          };
        }
      }
    }

    // 3. Category suggestions ("show categories", "what categories", "types of sarees")
    if (q.includes('category') || q.includes('categories') || q.includes('types of saree') || q.includes('collection')) {
      const categories = await AITools.getCategories();
      let msg = `🏛️ **Our Heritage Saree Weave Categories:**\n\n`;
      categories.forEach((c) => {
        msg += `• **${c.name}**: ${c.description || 'Authentic artisan handloom weave'}\n`;
      });
      msg += `\nYou can explore any category in our Shop catalog!`;
      return { content: msg, metadata: { type: 'faq' } };
    }

    // 4. Price & Search Filter ("sarees under 3000", "red saree", "kanjivaram silk")
    const priceMatch = q.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) ||
                       q.match(/(?:₹|rs\.?|inr)\s*(\d+)/i);
    const maxPrice = priceMatch ? parseInt(priceMatch[1], 10) : undefined;

    const colors = ['red', 'crimson', 'blue', 'navy', 'green', 'emerald', 'yellow', 'pink', 'black', 'peach', 'orange', 'lavender', 'mint', 'ivory', 'gold'];
    const matchedColor = colors.find((c) => q.includes(c));

    const fabrics = ['kanjivaram', 'banarasi', 'organza', 'chanderi', 'linen', 'bandhani', 'leheriya', 'sequin', 'silk', 'georgette', 'tissue', 'tussar'];
    const matchedFabric = fabrics.find((f) => q.includes(f));

    if (maxPrice || matchedColor || matchedFabric || q.includes('saree') || q.includes('recommend') || q.includes('show me')) {
      const products = await AITools.searchProducts({
        maxPrice,
        color: matchedColor,
        fabric: matchedFabric,
        inStockOnly: true,
        limit: 4,
      });

      if (products.length > 0) {
        let intro = `Here are authentic sarees matching your request`;
        if (matchedColor) intro += ` in **${matchedColor}**`;
        if (matchedFabric) intro += ` crafted in **${matchedFabric}**`;
        if (maxPrice) intro += ` under **${formatPrice(maxPrice)}**`;
        intro += `:\n`;

        return {
          content: `${intro}\nEach saree comes certified with authentic handloom hallmark, pure weave guarantee, and complimentary unstitched blouse piece. Tap any item to inspect fabric drape photos!`,
          metadata: {
            type: 'products',
            items: products,
          },
        };
      } else {
        const featured = await AITools.searchProducts({ limit: 3, inStockOnly: true });
        return {
          content: `We don't have an exact match for "${query}" right now, but here are our most beloved bestselling pieces:`,
          metadata: {
            type: 'products',
            items: featured,
          },
        };
      }
    }

    // 5. Shipping / Delivery queries
    if (q.includes('shipping') || q.includes('delivery') || q.includes('dispatch') || q.includes('how long') || q.includes('courier')) {
      return {
        content: `📦 **Shipping & Delivery Information:**\n\n` +
          `• **Free Express Shipping** on all orders above **₹1,999**!\n` +
          `• Standard delivery fee: **₹99** across all Indian PIN codes.\n` +
          `• Metro cities: Delivered in **2 to 4 business days**.\n` +
          `• Rest of India: Delivered in **4 to 6 business days**.\n` +
          `• Partnered with Blue Dart and Delhivery for tamper-evident insured delivery with live SMS tracking.`,
        metadata: { type: 'faq' },
      };
    }

    // 6. Return / Refund Policy
    if (q.includes('return') || q.includes('refund') || q.includes('exchange') || q.includes('cancel')) {
      return {
        content: `🔄 **7-Day Hassle-Free Returns & Exchange:**\n\n` +
          `• We offer a **7-day return policy** from the date of delivery.\n` +
          `• The saree must remain unused with original security tags, fabric fold, and invoice intact.\n` +
          `• Doorstep reverse pickup is arranged free of charge.\n` +
          `• Full refund is credited directly to your original payment method within 24-48 hours of inspection.`,
        metadata: { type: 'faq' },
      };
    }

    // 7. Store / Contact Info
    if (q.includes('contact') || q.includes('phone') || q.includes('email') || q.includes('address') || q.includes('store') || q.includes('whatsapp')) {
      return {
        content: `🏛️ **Royal Saree & Fashion** by TechWave Solutions\n\n` +
          `• 📞 **Helpline:** +91 9641145871\n` +
          `• 💬 **WhatsApp:** +919641145871\n` +
          `• ✉️ **Email:** techwavesolutions.dev@gmail.com\n` +
          `• 📍 **Headquarters:** TechWave Tower, Sector V, Salt Lake, Kolkata 700091\n` +
          `• Operating Hours: Mon-Sat, 10:00 AM – 8:00 PM IST`,
        metadata: { type: 'faq' },
      };
    }

    return {
      content: `Namaste! Welcome to **Royal Saree & Fashion**.\n\nI can help you with:\n` +
        `• Finding sarees (*e.g., "Show me red sarees under ₹3000" or "Lightweight Organza"*)\n` +
        `• Checking product availability (*e.g., "Is Kanjivaram in stock?"*)\n` +
        `• Live order tracking (*e.g., "Where is my order?"*)\n` +
        `• Fabric details, zari purity, and styling guidance\n` +
        `• Shipping fees and 7-day return guarantee\n\nHow may I assist your celebration today?`,
    };
  }

  static async processBusinessQuery(query: string): Promise<AIResponse> {
    const q = query.toLowerCase();

    // 1. Today's sales & orders
    if (q.includes("today's sales") || q.includes('sales today') || (q.includes('today') && (q.includes('sales') || q.includes('revenue')))) {
      const metrics = await AITools.getBusinessMetrics();
      return {
        content: `📊 **Today's Sales Performance:**\n\n` +
          `• **Today's Gross Sales:** **${formatPrice(metrics.todaySales)}**\n` +
          `• **Orders Placed Today:** **${metrics.todayOrdersCount}** orders\n` +
          `• **Unique Customers Ordered Today:** **${metrics.todayCustomersCount}**\n` +
          `• **Pending Orders:** **${metrics.pendingOrdersCount}** requiring fulfillment`,
        metadata: { type: 'analytics', stats: metrics },
      };
    }

    // 2. Month's revenue / turnover
    if (q.includes('month') || q.includes('monthly') || q.includes('revenue')) {
      const metrics = await AITools.getBusinessMetrics();
      return {
        content: `💰 **Revenue Summary:**\n\n` +
          `• **This Month's Revenue:** **${formatPrice(metrics.monthSales)}**\n` +
          `• **All-Time Verified Revenue:** **${formatPrice(metrics.totalRevenue)}**\n` +
          `• **Total Lifetime Orders:** **${metrics.totalOrdersCount}**\n` +
          `• **Today's Sales:** **${formatPrice(metrics.todaySales)}**`,
        metadata: { type: 'analytics', stats: metrics },
      };
    }

    // 3. Pending orders
    if (q.includes('pending') || q.includes('fulfillment') || q.includes('unfulfilled')) {
      const metrics = await AITools.getBusinessMetrics();
      return {
        content: `📦 **Pending Orders Status:**\n\n` +
          `• **Currently Pending Orders:** **${metrics.pendingOrdersCount}**\n` +
          `• Recommended Action: Review orders in the Fulfillment tab to update status to PACKED or SHIPPED and generate carrier waybills.`,
        metadata: { type: 'analytics', stats: { pendingOrdersCount: metrics.pendingOrdersCount } },
      };
    }

    // 4. Out of stock products
    if (q.includes('out of stock') || q.includes('zero stock') || q.includes('sold out')) {
      const metrics = await AITools.getBusinessMetrics();
      if (metrics.outOfStockItems.length > 0) {
        let msg = `🚫 **Out of Stock Sarees (${metrics.outOfStockCount} items):**\n\n`;
        metrics.outOfStockItems.forEach((p) => {
          msg += `• **${p.name}** (SKU: \`${p.sku}\`) — Stock: **0 units**\n`;
        });
        msg += `\nPlease initiate re-orders with the master weaver clusters.`;
        return {
          content: msg,
          metadata: { type: 'analytics', items: metrics.outOfStockItems },
        };
      } else {
        return {
          content: `✅ Excellent! None of your active saree catalog items are currently completely out of stock.`,
        };
      }
    }

    // 5. Low in stock products
    if (q.includes('stock') || q.includes('low') || q.includes('inventory') || q.includes('reorder')) {
      const metrics = await AITools.getBusinessMetrics();
      if (metrics.lowStockItems.length > 0) {
        let msg = `⚠️ **Low Stock Alert (${metrics.lowStockCount} items <= 5 units):**\n\n`;
        metrics.lowStockItems.forEach((p) => {
          msg += `• **${p.name}** (SKU: \`${p.sku}\`) — **Only ${p.stock} units remaining** (Threshold: 5)\n`;
        });
        msg += `\nRecommended: Replenish stock soon to prevent stockouts during peak wedding season.`;
        return {
          content: msg,
          metadata: { type: 'analytics', items: metrics.lowStockItems },
        };
      } else {
        return {
          content: `✅ All active products currently exceed their minimum reorder thresholds!`,
        };
      }
    }

    // 6. Category selling most
    if (q.includes('category') || q.includes('categories') || q.includes('weave type')) {
      const topCats = await AITools.getTopCategories();
      let msg = `🏆 **Category Sales & Revenue Ranking:**\n\n`;
      topCats.forEach((cat, idx) => {
        msg += `${idx + 1}. **${cat.name}**\n   • Revenue: **${formatPrice(cat.revenue)}** | Units Dispatched: **${cat.unitsSold}**\n`;
      });
      return {
        content: msg,
        metadata: { type: 'analytics', items: topCats },
      };
    }

    // 7. Customers ordered today
    if (q.includes('customer') || q.includes('how many customer') || q.includes('who ordered')) {
      const metrics = await AITools.getBusinessMetrics();
      return {
        content: `👥 **Customer Order Activity:**\n\n` +
          `• **Unique Customers Ordered Today:** **${metrics.todayCustomersCount}**\n` +
          `• **Total Registered Customer Base:** **${metrics.totalCustomersCount}**\n` +
          `• **Total Orders Today:** **${metrics.todayOrdersCount}**`,
        metadata: { type: 'analytics', stats: metrics },
      };
    }

    // 8. Recent orders
    if (q.includes('recent') || q.includes('latest order') || q.includes('last order')) {
      const metrics = await AITools.getBusinessMetrics();
      let msg = `📋 **5 Most Recent Customer Orders:**\n\n`;
      metrics.recentOrders.forEach((o, idx) => {
        msg += `${idx + 1}. **${o.orderNumber}** — ${o.customerName}\n   • Amount: **${formatPrice(o.total)}** | Status: **${o.status}** (${o.paymentStatus})\n   • Date: ${new Date(o.createdAt).toLocaleString()}\n`;
      });
      return {
        content: msg,
        metadata: { type: 'analytics', items: metrics.recentOrders },
      };
    }

    // 9. Best sellers / Top products
    if (q.includes('best') || q.includes('top') || q.includes('popular') || q.includes('selling')) {
      const topProducts = await AITools.getTopSellingProducts(5);
      let msg = `🏆 **Top Revenue Performing Sarees:**\n\n`;
      topProducts.forEach((item, idx) => {
        msg += `${idx + 1}. **${item.name}**\n   • Revenue: **${formatPrice(item.totalRevenue)}** | Units Dispatched: **${item.unitsSold}**\n`;
      });
      return {
        content: msg,
        metadata: { type: 'analytics', items: topProducts },
      };
    }

    return {
      content: `Hello Store Administrator. I am your **TechWave Retail360 Business Intelligence Assistant**.\n\nYou can ask me real-time questions such as:\n` +
        `• *"What are today's sales?"*\n` +
        `• *"What is this month's revenue?"*\n` +
        `• *"How many orders are pending?"*\n` +
        `• *"Which products are best sellers?"*\n` +
        `• *"Which products are low in stock?"*\n` +
        `• *"Which products are out of stock?"*\n` +
        `• *"Which category is selling the most?"*\n` +
        `• *"How many customers ordered today?"*\n` +
        `• *"What are the recent orders?"*`,
    };
  }
}

export class AIService {
  static async handleCustomerChat(
    message: string,
    history: AIChatMessage[] = [],
    user?: UserSession
  ): Promise<AIResponse> {
    return RuleBasedAIEngine.processCustomerQuery(message, history, user);
  }

  static async handleBusinessChat(message: string): Promise<AIResponse> {
    return RuleBasedAIEngine.processBusinessQuery(message);
  }
}
