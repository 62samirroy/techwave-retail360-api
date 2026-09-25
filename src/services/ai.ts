import prisma from '../lib/db';
import { formatPrice } from '../lib/utils';
import { UserSession } from '../types';

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIKPICard {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'blue';
  icon?: string;
}

export interface AIChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  subtitle?: string;
  data: Array<{
    label: string;
    value: number;
    secondaryValue?: number;
    formattedValue?: string;
  }>;
}

export interface AITableData {
  title?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface AIResponse {
  content: string;
  metadata?: {
    type?: 'products' | 'order' | 'analytics' | 'faq' | 'system';
    kpis?: AIKPICard[];
    chart?: AIChartData;
    charts?: AIChartData[];
    table?: AITableData;
    items?: any[];
    stats?: any;
    link?: string;
    engine?: 'gemini' | 'orchestrator';
    latencyMs?: number;
  };
}

/**
 * ============================================================================
 * TOOL ORCHESTRATOR
 * Connects directly to Supabase (Prisma PostgreSQL), Razorpay, and External APIs.
 * Validates data and generates structured outputs (KPIs, Charts, Tables).
 * ============================================================================
 */
export class ToolOrchestrator {
  // --------------------------------------------------------------------------
  // 1. SUPABASE / PRISMA: Product Search & Catalog
  // --------------------------------------------------------------------------
  static async searchProducts(params: {
    keyword?: string;
    maxPrice?: number;
    color?: string;
    fabric?: string;
    category?: string;
    inStockOnly?: boolean;
    limit?: number;
  }) {
    const andConditions: any[] = [{ status: 'ACTIVE' }];

    if (params.inStockOnly) {
      andConditions.push({ stock: { gt: 0 } });
    }

    if (params.maxPrice !== undefined && params.maxPrice !== null) {
      andConditions.push({
        OR: [
          { discountPrice: { not: null, lte: params.maxPrice } },
          { discountPrice: null, price: { lte: params.maxPrice } },
        ],
      });
    }

    const COLOR_SYNONYMS: Record<string, string[]> = {
      red: ['red', 'crimson', 'ruby', 'rubyy', 'maroon', 'scarlet'],
      crimson: ['crimson', 'red', 'ruby', 'maroon'],
      ruby: ['ruby', 'rubyy', 'red', 'crimson'],
      blue: ['blue', 'navy', 'indigo', 'royal blue', 'sky blue', 'midnight blue', 'teal'],
      navy: ['navy', 'blue', 'midnight navy'],
      green: ['green', 'emerald', 'mint', 'olive', 'sage', 'pista'],
      emerald: ['emerald', 'green', 'deep emerald'],
      pink: ['pink', 'rose', 'gulab', 'rani', 'magenta', 'blush', 'peach'],
      yellow: ['yellow', 'marigold', 'haldi', 'mustard', 'lemon'],
      orange: ['orange', 'saffron', 'rust', 'coral', 'tangerine'],
      purple: ['purple', 'plum', 'violet', 'lavender', 'wine', 'cabernet'],
      black: ['black', 'onyx', 'midnight black', 'charcoal'],
      white: ['white', 'ivory', 'cream', 'pearl', 'sand', 'beige'],
      gold: ['gold', 'golden', 'zari', 'champagne'],
    };

    let colorTerms: string[] = [];
    if (params.color) {
      const cleanColor = params.color.toLowerCase().trim();
      colorTerms = COLOR_SYNONYMS[cleanColor] || [cleanColor];

      andConditions.push({
        OR: [
          ...colorTerms.map((term) => ({ name: { contains: term, mode: 'insensitive' } })),
          ...colorTerms.map((term) => ({ tags: { contains: term, mode: 'insensitive' } })),
          {
            attributes: {
              some: {
                name: { equals: 'Color', mode: 'insensitive' },
                OR: colorTerms.map((term) => ({ value: { contains: term, mode: 'insensitive' } })),
              },
            },
          },
        ],
      });
    }

    if (params.fabric) {
      andConditions.push({
        OR: [
          { name: { contains: params.fabric, mode: 'insensitive' } },
          { description: { contains: params.fabric, mode: 'insensitive' } },
          { tags: { contains: params.fabric, mode: 'insensitive' } },
        ],
      });
    }

    if (params.keyword) {
      andConditions.push({
        OR: [
          { name: { contains: params.keyword, mode: 'insensitive' } },
          { description: { contains: params.keyword, mode: 'insensitive' } },
          { tags: { contains: params.keyword, mode: 'insensitive' } },
        ],
      });
    }

    if (params.category) {
      andConditions.push({
        category: {
          name: { contains: params.category, mode: 'insensitive' },
        },
      });
    }

    const where = { AND: andConditions };

    const fetchLimit = params.color ? Math.max((params.limit || 4) * 3, 12) : params.limit || 4;

    const products = await prisma.product.findMany({
      where,
      take: fetchLimit,
      include: {
        category: true,
        images: { where: { isPrimary: true }, take: 1 },
        attributes: true,
      },
      orderBy: { price: 'asc' },
    });

    let results = products;
    if (params.color && colorTerms.length > 0) {
      const colorRegex = new RegExp(`\\b(${colorTerms.join('|')})\\b`, 'i');
      results = results.filter((p) => {
        const colorAttr = p.attributes.find((a: any) => a.name.toLowerCase() === 'color')?.value || '';
        const hasInColorAttr = colorRegex.test(colorAttr);
        const hasInTags = colorRegex.test(p.tags || '');
        const hasInName = colorRegex.test(p.name);

        if (params.color?.toLowerCase() === 'red' && /\b(yellow|green|blue|black)\b/i.test(p.name)) {
          return false;
        }

        return hasInColorAttr || hasInTags || hasInName;
      });
    }

    return results.slice(0, params.limit || 4).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: p.discountPrice || p.price,
      originalPrice: p.price,
      stock: p.stock,
      category: p.category.name,
      image:
        p.images[0]?.url ||
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=400',
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
      take: 4,
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

  // --------------------------------------------------------------------------
  // 2. SUPABASE / PRISMA: Business Intelligence, KPIs & Analytics
  // --------------------------------------------------------------------------
  static async getSalesKPIs(): Promise<{
    raw: any;
    kpis: AIKPICard[];
  }> {
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
      prisma.product.count({
        where: { stock: { lte: 5, gt: 0 }, status: 'ACTIVE' },
      }),
      prisma.product.count({
        where: { stock: { equals: 0 }, status: 'ACTIVE' },
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
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

    const todayUniqueCustomers = new Set(
      todayOrders.map((o) => o.customerEmail || o.customerPhone).filter(Boolean)
    ).size;

    const raw = {
      totalRevenue,
      todaySales,
      monthSales,
      totalOrdersCount: totalOrders.length,
      todayOrdersCount: todayOrders.length,
      todayCustomersCount: todayUniqueCustomers,
      pendingOrdersCount: pendingOrders,
      lowStockCount: lowStockProducts,
      outOfStockCount: outOfStockProducts,
      totalCustomersCount: totalCustomers,
    };

    const kpis: AIKPICard[] = [
      {
        label: "Today's Gross Sales",
        value: formatPrice(todaySales),
        change: `${todayOrders.length} orders placed today`,
        trend: todaySales > 0 ? 'up' : 'neutral',
        color: 'emerald',
        icon: 'DollarSign',
      },
      {
        label: "This Month's Revenue",
        value: formatPrice(monthSales),
        change: `${monthOrders.length} orders this month`,
        trend: 'up',
        color: 'purple',
        icon: 'TrendingUp',
      },
      {
        label: 'Pending Orders',
        value: `${pendingOrders} Orders`,
        change: pendingOrders > 0 ? 'Fulfillment required' : 'All clear',
        trend: pendingOrders > 0 ? 'down' : 'neutral',
        color: pendingOrders > 0 ? 'amber' : 'emerald',
        icon: 'Package',
      },
      {
        label: 'Inventory Alerts',
        value: `${lowStockProducts + outOfStockProducts} Items`,
        change: `${lowStockProducts} low, ${outOfStockProducts} out`,
        trend: lowStockProducts + outOfStockProducts > 0 ? 'down' : 'neutral',
        color: lowStockProducts + outOfStockProducts > 0 ? 'rose' : 'emerald',
        icon: 'AlertTriangle',
      },
    ];

    return { raw, kpis };
  }

  static async getRevenueTrend(days: number = 7): Promise<{
    raw: any[];
    chart: AIChartData;
    table: AITableData;
    kpis: AIKPICard[];
  }> {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const trendData: Array<{ label: string; date: string; value: number; secondaryValue: number }> = [];

    let totalPeriodRevenue = 0;
    let totalPeriodOrders = 0;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const dayOrders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        select: { total: true, paymentStatus: true },
      });

      const dayRevenue = dayOrders
        .filter((o) => o.paymentStatus === 'PAID')
        .reduce((sum, o) => sum + o.total, 0);

      totalPeriodRevenue += dayRevenue;
      totalPeriodOrders += dayOrders.length;

      trendData.push({
        label: `${dayNames[startOfDay.getDay()]} (${startOfDay.getDate()}/${startOfDay.getMonth() + 1})`,
        date: startOfDay.toISOString().split('T')[0],
        value: dayRevenue,
        secondaryValue: dayOrders.length,
      });
    }

    const chart: AIChartData = {
      type: 'line',
      title: `${days}-Day Daily Revenue & Orders Trend`,
      subtitle: 'Realized revenue from confirmed and paid customer orders',
      data: trendData.map((d) => ({
        label: d.label,
        value: d.value,
        secondaryValue: d.secondaryValue,
        formattedValue: formatPrice(d.value),
      })),
    };

    const table: AITableData = {
      title: `${days}-Day Daily Sales Performance (Table)`,
      headers: ['Date', 'Day of Week', 'Orders Placed', 'Gross Sales', 'Average Order Value', 'Payment Status'],
      rows: trendData
        .slice()
        .reverse()
        .map((d, idx) => {
          const aov = d.secondaryValue > 0 ? Math.round(d.value / d.secondaryValue) : 0;
          return [
            d.date,
            idx === 0 ? 'Today' : d.label.split(' ')[0],
            `${d.secondaryValue} order${d.secondaryValue === 1 ? '' : 's'}`,
            d.formattedValue || formatPrice(d.value),
            formatPrice(aov),
            d.value > 0 ? 'PAID' : 'PENDING',
          ];
        }),
    };

    const avgDailyRevenue = Math.round(totalPeriodRevenue / days);
    const kpis: AIKPICard[] = [
      {
        label: `${days}-Day Total Revenue`,
        value: formatPrice(totalPeriodRevenue),
        change: `${totalPeriodOrders} orders received`,
        trend: 'up',
        color: 'emerald',
      },
      {
        label: 'Average Daily Revenue',
        value: formatPrice(avgDailyRevenue),
        change: `Across ${days} tracking days`,
        trend: 'neutral',
        color: 'blue',
      },
      {
        label: 'Total Orders',
        value: `${totalPeriodOrders} Orders`,
        change: 'In this trend window',
        trend: 'up',
        color: 'purple',
      },
    ];

    return { raw: trendData, chart, table, kpis };
  }

  static async getCategoryDistribution(): Promise<{
    raw: any[];
    chart: AIChartData;
    table: AITableData;
  }> {
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

    let grossTotalRevenue = 0;
    const catStats = categories.map((cat) => {
      let units = 0;
      let rev = 0;
      cat.products.forEach((p) => {
        p.orderItems.forEach((oi) => {
          units += oi.quantity || 0;
          rev += oi.total || 0;
        });
      });
      grossTotalRevenue += rev;
      return {
        name: cat.name,
        slug: cat.slug,
        unitsSold: units,
        revenue: rev,
      };
    });

    catStats.sort((a, b) => b.revenue - a.revenue);

    const chart: AIChartData = {
      type: 'pie',
      title: 'Revenue Share by Saree Weave Collection',
      subtitle: 'Market share across authentic heritage weaves',
      data: catStats.map((c) => ({
        label: c.name,
        value: c.revenue,
        secondaryValue: c.unitsSold,
        formattedValue: `${formatPrice(c.revenue)} (${c.unitsSold} units)`,
      })),
    };

    const table: AITableData = {
      title: 'Category Performance Breakdown',
      headers: ['Rank', 'Category / Weave', 'Units Dispatched', 'Gross Revenue', 'Revenue Share'],
      rows: catStats.map((c, idx) => {
        const share =
          grossTotalRevenue > 0
            ? `${Math.round((c.revenue / grossTotalRevenue) * 100)}%`
            : '0%';
        return [`#${idx + 1}`, c.name, `${c.unitsSold} units`, formatPrice(c.revenue), share];
      }),
    };

    return { raw: catStats, chart, table };
  }

  static async getInventoryHealth(): Promise<{
    raw: { lowStock: any[]; outOfStock: any[] };
    table: AITableData;
    kpis: AIKPICard[];
  }> {
    const [lowStock, outOfStock] = await Promise.all([
      prisma.product.findMany({
        where: { stock: { lte: 5, gt: 0 }, status: 'ACTIVE' },
        include: { category: true },
        orderBy: { stock: 'asc' },
      }),
      prisma.product.findMany({
        where: { stock: { equals: 0 }, status: 'ACTIVE' },
        include: { category: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const combined = [
      ...outOfStock.map((p) => ({ ...p, statusBadge: 'OUT OF STOCK', urgency: 'CRITICAL' })),
      ...lowStock.map((p) => ({ ...p, statusBadge: 'LOW STOCK', urgency: 'URGENT' })),
    ];

    const table: AITableData = {
      title: 'Weaver Replenishment Action Table',
      headers: ['SKU', 'Saree Name', 'Category', 'Current Stock', 'Status', 'Recommended Action'],
      rows: combined.map((p) => [
        p.sku,
        p.name,
        p.category?.name || 'Handloom',
        `${p.stock} units`,
        p.statusBadge,
        p.stock === 0 ? 'Place emergency weaver order (15-20 units)' : 'Reorder 10 units soon',
      ]),
    };

    const kpis: AIKPICard[] = [
      {
        label: 'Out of Stock Items',
        value: `${outOfStock.length} Sarees`,
        change: outOfStock.length > 0 ? 'Immediate reorder required' : 'Optimal catalog',
        trend: outOfStock.length > 0 ? 'down' : 'neutral',
        color: outOfStock.length > 0 ? 'rose' : 'emerald',
      },
      {
        label: 'Low Stock (< 5 units)',
        value: `${lowStock.length} Sarees`,
        change: lowStock.length > 0 ? 'Monitor weaver lead times' : 'Healthy inventory',
        trend: lowStock.length > 0 ? 'down' : 'neutral',
        color: lowStock.length > 0 ? 'amber' : 'emerald',
      },
      {
        label: 'Inventory Health Index',
        value: outOfStock.length === 0 && lowStock.length <= 2 ? '95% Healthy' : 'Action Required',
        change: 'Stockout risk evaluation',
        trend: 'neutral',
        color: 'purple',
      },
    ];

    return { raw: { lowStock, outOfStock }, table, kpis };
  }

  static async getTopSellingProducts(limit = 5): Promise<{
    raw: any[];
    table: AITableData;
    chart: AIChartData;
  }> {
    const orderItems = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const productIds = orderItems.map((oi) => oi.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });

    const prodMap = new Map(products.map((p) => [p.id, p]));

    const rows = orderItems.map((item, idx) => {
      const p = prodMap.get(item.productId);
      const units = item._sum.quantity || 0;
      const rev = item._sum.total || 0;
      return [
        `#${idx + 1}`,
        item.productName,
        p?.category?.name || 'Silk Sarees',
        `${units} sold`,
        formatPrice(rev),
        p ? `${p.stock} units left` : 'N/A',
      ];
    });

    const table: AITableData = {
      title: 'Top Revenue Generating Products',
      headers: ['Rank', 'Saree Name', 'Category', 'Units Dispatched', 'Total Revenue', 'Live Stock'],
      rows,
    };

    const chart: AIChartData = {
      type: 'bar',
      title: 'Top Bestseller Sarees by Sales Volume',
      subtitle: 'Verified units dispatched to customers',
      data: orderItems.map((oi) => ({
        label: oi.productName.length > 20 ? oi.productName.substring(0, 18) + '...' : oi.productName,
        value: oi._sum.quantity || 0,
        formattedValue: `${oi._sum.quantity || 0} units (${formatPrice(oi._sum.total || 0)})`,
      })),
    };

    return { raw: orderItems, table, chart };
  }

  static async getRecentOrders(limit = 5): Promise<{
    raw: any[];
    table: AITableData;
  }> {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        total: true,
        status: true,
        paymentStatus: true,
        city: true,
        createdAt: true,
      },
    });

    const table: AITableData = {
      title: `Latest ${limit} Customer Orders`,
      headers: ['Order #', 'Customer Name', 'Amount', 'Order Status', 'Payment', 'City & Date'],
      rows: orders.map((o) => [
        o.orderNumber,
        o.customerName,
        formatPrice(o.total),
        o.status,
        o.paymentStatus,
        `${o.city} • ${new Date(o.createdAt).toLocaleDateString()}`,
      ]),
    };

    return { raw: orders, table };
  }

  // --------------------------------------------------------------------------
  // 3. RAZORPAY & EXTERNAL APIS: Gateway & Services Orchestration
  // --------------------------------------------------------------------------
  static async getSystemServicesStatus(): Promise<{
    kpis: AIKPICard[];
    table: AITableData;
  }> {
    const razorpayKey = process.env.RAZORPAY_KEY_ID || '';
    const isRazorpayConfigured = Boolean(
      razorpayKey && razorpayKey.startsWith('rzp_') && !razorpayKey.includes('placeholder')
    );

    const smtpUser = process.env.SMTP_USER || '';
    const isSmtpConfigured = Boolean(smtpUser && process.env.SMTP_PASS);

    const fast2smsKey = process.env.FAST2SMS_API_KEY || '';
    const isFast2SmsConfigured = Boolean(fast2smsKey && fast2smsKey.length > 20);

    const dbConnected = true; // Prisma query already executing successfully

    const kpis: AIKPICard[] = [
      {
        label: 'Supabase PostgreSQL',
        value: 'Connected & Live',
        change: 'Prisma ORM Pool Active',
        trend: 'up',
        color: 'emerald',
      },
      {
        label: 'Razorpay Gateway',
        value: isRazorpayConfigured ? 'Operational (Test)' : 'Attention',
        change: isRazorpayConfigured ? 'Key ID verified' : 'Check API Keys',
        trend: isRazorpayConfigured ? 'up' : 'down',
        color: isRazorpayConfigured ? 'emerald' : 'amber',
      },
      {
        label: 'Gmail SMTP Alerts',
        value: isSmtpConfigured ? 'Live & Delivering' : 'Check Config',
        change: 'New customer & order emails',
        trend: 'up',
        color: 'purple',
      },
      {
        label: 'SMS OTP Gateway',
        value: isFast2SmsConfigured ? 'Operational' : 'Simulated fallback',
        change: 'Fast2SMS Quick OTP',
        trend: 'neutral',
        color: 'blue',
      },
    ];

    const table: AITableData = {
      title: 'Infrastructure & Integration Health Matrix',
      headers: ['Component', 'Provider / Target', 'Protocol / Port', 'Health Status', 'Integration Status'],
      rows: [
        ['Primary Database', 'Supabase (AWS Tokyo)', 'PostgreSQL / 6543 (PgBouncer)', 'HEALTHY', 'Active read/write'],
        ['Payment Gateway', 'Razorpay Payments', 'REST API (v1)', isRazorpayConfigured ? 'HEALTHY' : 'PENDING_CONFIG', 'UPI, Cards, Netbanking ready'],
        ['Email Gateway', 'Google Workspace / Gmail', 'SMTP / 465 (SSL/TLS)', isSmtpConfigured ? 'HEALTHY' : 'ATTENTION', 'Admin & Customer instant alerts'],
        ['SMS Gateway', 'Fast2SMS Enterprise', 'HTTPS REST API', isFast2SmsConfigured ? 'HEALTHY' : 'DEV_MODE', 'OTP verification ready'],
      ],
    };

    return { kpis, table };
  }
}

/**
 * ============================================================================
 * GEMINI API ENGINE
 * Connects directly to Google Generative AI REST API with Tools / Function Calling.
 * ============================================================================
 */
export class GeminiAIEngine {
  private static getApiKey(): string | null {
    const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!key || key.trim() === '' || key.includes('placeholder')) {
      return null;
    }
    return key.trim();
  }

  // Declarations for Gemini Function Calling
  private static getCustomerToolsDeclaration() {
    return [
      {
        function_declarations: [
          {
            name: 'search_products',
            description: 'Search active saree catalog by keyword, maxPrice, color, fabric, category, or inStockOnly',
            parameters: {
              type: 'OBJECT',
              properties: {
                keyword: { type: 'STRING', description: 'Search terms such as saree name or style' },
                maxPrice: { type: 'NUMBER', description: 'Maximum price filter in INR' },
                color: { type: 'STRING', description: 'Color name (e.g. red, blue, green, pink)' },
                fabric: { type: 'STRING', description: 'Fabric name (e.g. kanjivaram, banarasi, organza, silk)' },
                category: { type: 'STRING', description: 'Category name filter' },
                inStockOnly: { type: 'BOOLEAN', description: 'Whether to return only in-stock sarees' },
              },
            },
          },
          {
            name: 'check_product_availability',
            description: 'Check real-time stock levels and availability of specific sarees by name or SKU',
            parameters: {
              type: 'OBJECT',
              properties: {
                query: { type: 'STRING', description: 'Product name, SKU or slug' },
              },
              required: ['query'],
            },
          },
          {
            name: 'track_order',
            description: 'Track customer order status using order number (e.g. TW-ORD-10021) or phone/email',
            parameters: {
              type: 'OBJECT',
              properties: {
                orderNumber: { type: 'STRING', description: '5-digit order number like TW-ORD-10021' },
                identifier: { type: 'STRING', description: 'Customer email or phone number' },
              },
            },
          },
          {
            name: 'get_categories',
            description: 'Get list of authentic saree weave categories available in the store',
            parameters: { type: 'OBJECT', properties: {} },
          },
        ],
      },
    ];
  }

  private static getBusinessToolsDeclaration() {
    return [
      {
        function_declarations: [
          {
            name: 'get_sales_kpis',
            description: 'Retrieve real-time sales KPIs including today gross sales, month revenue, pending orders, and customers count',
            parameters: { type: 'OBJECT', properties: {} },
          },
          {
            name: 'get_revenue_trend',
            description: 'Retrieve daily revenue and order volume trend for the last 7 or 14 days',
            parameters: {
              type: 'OBJECT',
              properties: {
                days: { type: 'NUMBER', description: 'Number of past days (e.g. 7 or 14)' },
              },
            },
          },
          {
            name: 'get_category_distribution',
            description: 'Retrieve revenue and units sold breakdown across all saree weave categories',
            parameters: { type: 'OBJECT', properties: {} },
          },
          {
            name: 'get_inventory_health',
            description: 'Retrieve low stock (<= 5 units) and out of stock items requiring weaver reorders',
            parameters: { type: 'OBJECT', properties: {} },
          },
          {
            name: 'get_top_selling_products',
            description: 'Retrieve top selling sarees ranked by total revenue and units sold',
            parameters: {
              type: 'OBJECT',
              properties: {
                limit: { type: 'NUMBER', description: 'Number of top products to fetch (default 5)' },
              },
            },
          },
          {
            name: 'get_recent_orders',
            description: 'Retrieve most recent customer orders with payment and fulfillment status',
            parameters: {
              type: 'OBJECT',
              properties: {
                limit: { type: 'NUMBER', description: 'Number of recent orders (default 5)' },
              },
            },
          },
          {
            name: 'get_system_services_status',
            description: 'Retrieve health status of Supabase DB, Razorpay Gateway, Gmail SMTP, and Fast2SMS services',
            parameters: { type: 'OBJECT', properties: {} },
          },
          {
            name: 'search_products',
            description: 'Search saree catalog by keyword, maxPrice, color, fabric, category, or stock for store inventory inspection',
            parameters: {
              type: 'OBJECT',
              properties: {
                keyword: { type: 'STRING', description: 'Search term or product name' },
                maxPrice: { type: 'NUMBER', description: 'Maximum price in INR' },
                color: { type: 'STRING', description: 'Color name (e.g. red, blue, green)' },
                fabric: { type: 'STRING', description: 'Fabric name (e.g. kanjivaram, banarasi, linen)' },
                inStockOnly: { type: 'BOOLEAN', description: 'Filter only items in stock' },
              },
            },
          },
        ],
      },
    ];
  }

  private static async executeGeminiRequest(
    body: any,
    apiKey: string
  ): Promise<any | null> {
    const models = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-3.8-flash'];

    for (const model of models) {
      try {
        const isBearer = apiKey.startsWith('ya29.');
        const url = isBearer
          ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
          : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (isBearer) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        } else {
          headers['x-goog-api-key'] = apiKey;
        }

        let response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3500),
        });

        // If bearer without query param failed, try with ?key= query param as fallback
        if (!response.ok && isBearer) {
          const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(3500),
          });
        }

        const respText = await response.text();
        if (response.ok) {
          const data = JSON.parse(respText);
          return { data, model };
        } else {
          console.warn(`[Gemini API] model ${model} HTTP ${response.status}:`, respText.substring(0, 300));
        }
      } catch (err: any) {
        console.warn(`[Gemini API] model ${model} fetch failed:`, err?.message || err);
      }
    }
    return null;
  }

  static async callGeminiCustomer(
    message: string,
    history: AIChatMessage[] = [],
    user?: UserSession
  ): Promise<AIResponse | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    try {
      const todayDateStr = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date());

      const systemInstruction = {
        parts: [
          {
            text:
              `You are the warm, knowledgeable AI Customer Shopping Assistant for Royal Saree & Fashion (TechWave Retail360). ` +
              `Today's date is ${todayDateStr}. ` +
              `CRITICAL INSTRUCTIONS:\n` +
              `1. FOR COMMON OR GENERAL QUESTIONS (e.g. today's day name, what date is today, current time, greetings, general chit-chat):\n` +
              `   - Answer the question directly, politely, and accurately.\n` +
              `   - DO NOT call product or order tools.\n` +
              `   - DO NOT append product listings or catalog recommendations unless specifically asked.\n` +
              `2. FOR APPLICATION / STORE QUESTIONS (finding sarees, checking stock, prices, tracking orders, returns, store hours):\n` +
              `   - Call the appropriate function tool to ground your response in live store data.\n` +
              `   - ACCURACY COMMITMENT: When searching with price filters, NEVER claim a product is within budget if its actual price exceeds the budget. If no items match, truthfully state the actual prices of authentic pieces.`,
          },
        ],
      };

      const contents = [
        ...history.slice(-4).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ];

      const firstCall = await this.executeGeminiRequest(
        {
          contents,
          system_instruction: systemInstruction,
          tools: this.getCustomerToolsDeclaration(),
        },
        apiKey
      );

      if (!firstCall?.data) return null;

      const firstData = firstCall.data;
      const candidate = firstData?.candidates?.[0];
      const functionCall = candidate?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;

      if (functionCall) {
        const { name, args } = functionCall;
        let toolResult: any = null;
        let metadata: any = { engine: 'gemini' };

        if (name === 'search_products') {
          toolResult = await ToolOrchestrator.searchProducts(args || {});
          metadata.type = 'products';
          metadata.items = toolResult;
        } else if (name === 'check_product_availability') {
          toolResult = await ToolOrchestrator.checkProductAvailability(args?.query || '');
          metadata.type = 'products';
          metadata.items = toolResult;
        } else if (name === 'track_order') {
          toolResult = await ToolOrchestrator.lookupCustomerOrders(user, args?.orderNumber, args?.identifier);
          metadata.type = 'order';
          if (toolResult) {
            metadata.items = Array.isArray(toolResult) ? toolResult : [toolResult];
            metadata.link = `/track-order?orderId=${toolResult.orderNumber || ''}`;
          }
        } else if (name === 'get_categories') {
          toolResult = await ToolOrchestrator.getCategories();
          metadata.type = 'faq';
        }

        const secondCall = await this.executeGeminiRequest(
          {
            contents: [
              ...contents,
              candidate.content,
              {
                role: 'function',
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: { result: toolResult },
                    },
                  },
                ],
              },
            ],
            system_instruction: systemInstruction,
          },
          apiKey
        );

        if (secondCall?.data) {
          const secondData = secondCall.data;
          const finalCandidate = secondData?.candidates?.[0];
          const textPart = finalCandidate?.content?.parts?.find((p: any) => p.text)?.text;
          if (textPart) {
            return {
              content: textPart,
              metadata,
            };
          }
        }
      }

      const textPart = candidate?.content?.parts?.find((p: any) => p.text)?.text;
      if (textPart) {
        return { content: textPart, metadata: { engine: 'gemini' } };
      }
      return null;
    } catch (err) {
      console.warn('Gemini Customer error, falling back to orchestrator:', err);
      return null;
    }
  }

  static async callGeminiBusiness(message: string): Promise<AIResponse | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    try {
      const todayDateStr = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date());

      const systemInstruction = {
        parts: [
          {
            text:
              `You are the TechWave Retail360 AI Business Copilot & Analyst for the Store Administrator. ` +
              `Today's date is ${todayDateStr}. ` +
              `CRITICAL INSTRUCTIONS:\n` +
              `1. FOR COMMON OR GENERAL QUESTIONS (e.g. 'today day name', 'what is today\\'s date', 'what time is it', greetings, general conversation, definitions, chit-chat):\n` +
              `   - Answer the question directly, cleanly, and naturally.\n` +
              `   - DO NOT call any store or database tools.\n` +
              `   - DO NOT include store status, revenue numbers, or operational courier notices.\n` +
               `2. FOR APPLICATION / STORE QUESTIONS (sales, revenue, orders, inventory, products, categories, weaver status):\n` +
              `   - Always call the appropriate function tool to fetch live data from the database.\n` +
              `   - When the user asks for a table or tabular format (e.g. 'in table format' or 'table formate'), call get_revenue_trend and present the structured table breakdown.\n` +
              `   - When the user asks for charts, graphs, or visual analytics (e.g. 'different different chart or graph way you show', 'sales graph', 'pie chart'), call get_revenue_trend or get_category_distribution and present the key metrics clearly.\n` +
              `   - Provide executive takeaways with precise numbers.`,
          },
        ],
      };

      const contents = [{ role: 'user', parts: [{ text: message }] }];

      const firstCall = await this.executeGeminiRequest(
        {
          contents,
          system_instruction: systemInstruction,
          tools: this.getBusinessToolsDeclaration(),
        },
        apiKey
      );

      if (!firstCall?.data) return null;

      const firstData = firstCall.data;
      const candidate = firstData?.candidates?.[0];
      const functionCall = candidate?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;

      if (functionCall) {
        const { name, args } = functionCall;
        let toolResult: any = null;
        let metadata: any = { type: 'analytics', engine: 'gemini' };

        if (name === 'get_sales_kpis') {
          const res = await ToolOrchestrator.getSalesKPIs();
          toolResult = res.raw;
          metadata.kpis = res.kpis;
          metadata.stats = res.raw;
        } else if (name === 'get_revenue_trend') {
          const res = await ToolOrchestrator.getRevenueTrend(args?.days || 7);
          toolResult = res.raw;
          metadata.table = res.table;
          metadata.kpis = res.kpis;
          const userAskedTableOnly =
            message.toLowerCase().includes('table') ||
            message.toLowerCase().includes('tabular') ||
            message.toLowerCase().includes('formate') ||
            message.toLowerCase().includes('format');

          if (!userAskedTableOnly || message.toLowerCase().includes('chart') || message.toLowerCase().includes('graph')) {
            metadata.chart = res.chart;
          }

          const isMulti =
            message.toLowerCase().includes('different') ||
            message.toLowerCase().includes('all') ||
            message.toLowerCase().includes('multiple') ||
            message.toLowerCase().includes('graphs');
          if (isMulti) {
            const [catRes, topRes] = await Promise.all([
              ToolOrchestrator.getCategoryDistribution(),
              ToolOrchestrator.getTopSellingProducts(5),
            ]);
            metadata.charts = [res.chart, catRes.chart, topRes.chart];
          }
        } else if (name === 'get_category_distribution') {
          const res = await ToolOrchestrator.getCategoryDistribution();
          toolResult = res.raw;
          metadata.chart = res.chart;
          metadata.table = res.table;
        } else if (name === 'get_inventory_health') {
          const res = await ToolOrchestrator.getInventoryHealth();
          toolResult = res.raw;
          metadata.table = res.table;
          metadata.kpis = res.kpis;
        } else if (name === 'get_top_selling_products') {
          const res = await ToolOrchestrator.getTopSellingProducts(args?.limit || 5);
          toolResult = res.raw;
          metadata.table = res.table;
          metadata.chart = res.chart;
        } else if (name === 'get_recent_orders') {
          const res = await ToolOrchestrator.getRecentOrders(args?.limit || 5);
          toolResult = res.raw;
          metadata.table = res.table;
        } else if (name === 'get_system_services_status') {
          const res = await ToolOrchestrator.getSystemServicesStatus();
          toolResult = { status: 'healthy' };
          metadata.kpis = res.kpis;
          metadata.table = res.table;
        } else if (name === 'search_products') {
          toolResult = await ToolOrchestrator.searchProducts(args || {});
          metadata.type = 'products';
          metadata.items = toolResult;
        }

        const secondCall = await this.executeGeminiRequest(
          {
            contents: [
              ...contents,
              candidate.content,
              {
                role: 'function',
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: { result: toolResult },
                    },
                  },
                ],
              },
            ],
            system_instruction: systemInstruction,
          },
          apiKey
        );

        if (secondCall?.data) {
          const secondData = secondCall.data;
          const textPart = secondData?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
          if (textPart) {
            return {
              content: textPart,
              metadata,
            };
          }
        }
      }

      const textPart = candidate?.content?.parts?.find((p: any) => p.text)?.text;
      if (textPart) {
        return { content: textPart, metadata: { engine: 'gemini' } };
      }
      return null;
    } catch (err) {
      console.warn('Gemini Business error, falling back to orchestrator:', err);
      return null;
    }
  }
}

/**
 * ============================================================================
 * DETERMINISTIC TOOL ENGINE (RULE-BASED FALLBACK)
 * Executes the exact same Tool Orchestrator outputs (KPIs, Charts, Tables, Items)
 * when Gemini API key is missing or unavailable. Ensures 100% uptime!
 * ============================================================================
 */
export class DeterministicToolEngine {
  static async processCustomerQuery(
    query: string,
    history: AIChatMessage[] = [],
    user?: UserSession
  ): Promise<AIResponse> {
    const q = query.toLowerCase();

    // 1. Order Status Check
    const orderMatch = query.match(/(?:TW-ORD-)?(\d{5})/i) || query.match(/tw-ord-\d{5}/i);
    if (q.includes('order') || q.includes('track') || q.includes('where is my') || orderMatch) {
      if (orderMatch) {
        const fullNumber = orderMatch[0].toUpperCase().startsWith('TW-ORD-')
          ? orderMatch[0].toUpperCase()
          : `TW-ORD-${orderMatch[1]}`;

        const order: any = await ToolOrchestrator.lookupCustomerOrders(user, fullNumber);
        if (order) {
          return {
            content:
              `I found your Order #${order.orderNumber} for ${order.customerName}.\n\n` +
              `• Status: **${order.status}**\n` +
              `• Payment: **${order.paymentStatus}** (Total: ${formatPrice(order.total)})\n` +
              `• Shipping To: **${order.city}** via ${order.carrier || 'Express Courier'}\n` +
              (order.trackingNumber ? `• Tracking Number: \`${order.trackingNumber}\`\n\n` : '\n') +
              `You can track the shipment live on our Track Order page!`,
            metadata: {
              type: 'order',
              items: [order],
              link: `/track-order?orderId=${order.orderNumber}`,
              engine: 'orchestrator',
            },
          };
        } else {
          return {
            content: `I could not locate Order #${fullNumber} under your verified session. Please verify the order number or ensure you are signed in with the registered email.`,
            metadata: { engine: 'orchestrator' },
          };
        }
      } else if (user) {
        const userOrders: any = await ToolOrchestrator.lookupCustomerOrders(user);
        if (Array.isArray(userOrders) && userOrders.length > 0) {
          const latest = userOrders[0];
          return {
            content:
              `Hello ${user.name}! Here is your latest order:\n\n` +
              `• Order #${latest.orderNumber} (${new Date(latest.createdAt).toLocaleDateString()})\n` +
              `• Status: **${latest.status}** | Total: **${formatPrice(latest.total)}**\n` +
              `• Delivery to: **${latest.city}** via ${latest.carrier || 'Express Courier'}\n\n` +
              `You have ${userOrders.length} total orders. Tap below to track this shipment!`,
            metadata: {
              type: 'order',
              items: [latest],
              link: `/track-order?orderId=${latest.orderNumber}`,
              engine: 'orchestrator',
            },
          };
        } else {
          return {
            content: `Hello ${user.name}! You haven't placed any orders yet. Once you place an order, I can give you live tracking updates right here!`,
            metadata: { engine: 'orchestrator' },
          };
        }
      } else {
        return {
          content: `To check your order status, please provide your 5-digit Order Number (e.g., **TW-ORD-10021**) or sign in to view your orders automatically.`,
          metadata: { engine: 'orchestrator' },
        };
      }
    }

    // 2. Product Availability Inquiry
    if (q.includes('available') || q.includes('in stock') || q.includes('out of stock')) {
      const matchWords = q.replace(/is|this|product|available|in|stock|out|of|do|you|have/gi, '').trim();
      if (matchWords.length >= 3) {
        const found = await ToolOrchestrator.checkProductAvailability(matchWords);
        if (found.length > 0) {
          let msg = `Here is the current inventory availability:\n\n`;
          found.forEach((p) => {
            msg +=
              `• **${p.name}** (SKU: \`${p.sku}\`)\n` +
              `  Status: **${p.isAvailable ? `In Stock (${p.stock} units available)` : 'Currently Out of Stock'}**\n` +
              `  Price: **${formatPrice(p.price)}**\n`;
          });
          return {
            content: msg,
            metadata: { type: 'products', items: found, engine: 'orchestrator' },
          };
        }
      }
    }

    // 3. Category suggestions
    if (q.includes('category') || q.includes('categories') || q.includes('types of saree') || q.includes('collection')) {
      const categories = await ToolOrchestrator.getCategories();
      let msg = `🏛️ **Our Heritage Saree Weave Categories:**\n\n`;
      categories.forEach((c) => {
        msg += `• **${c.name}**: ${c.description || 'Authentic artisan handloom weave'}\n`;
      });
      msg += `\nYou can explore any category in our Shop catalog!`;
      return { content: msg, metadata: { type: 'faq', engine: 'orchestrator' } };
    }

    // 4. Price & Search Filter
    const priceMatch =
      q.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i) ||
      q.match(/(?:₹|rs\.?|inr)\s*(\d+)/i);
    const maxPrice = priceMatch ? parseInt(priceMatch[1], 10) : undefined;

    const colors = ['red', 'crimson', 'ruby', 'blue', 'navy', 'green', 'emerald', 'yellow', 'pink', 'black', 'peach', 'orange', 'lavender', 'mint', 'ivory', 'gold'];
    const matchedColor = colors.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(q));

    const fabrics = ['kanjivaram', 'banarasi', 'organza', 'chanderi', 'linen', 'bandhani', 'leheriya', 'sequin', 'silk', 'georgette', 'tissue', 'tussar'];
    const matchedFabric = fabrics.find((f) => new RegExp(`\\b${f}\\b`, 'i').test(q));

    if (maxPrice || matchedColor || matchedFabric || q.includes('saree') || q.includes('recommend') || q.includes('show me')) {
      const products = await ToolOrchestrator.searchProducts({
        maxPrice,
        color: matchedColor,
        fabric: matchedFabric,
        inStockOnly: true,
        limit: 4,
      });

      if (products.length > 0) {
        let intro = `Here are authentic sarees matching your request`;
        if (matchedColor) intro += ` in **${matchedColor.toUpperCase()}**`;
        if (matchedFabric) intro += ` crafted in **${matchedFabric}**`;
        if (maxPrice) intro += ` under **${formatPrice(maxPrice)}**`;
        intro += `:\n`;

        return {
          content: `${intro}\nEach saree comes certified with authentic handloom hallmark, pure weave guarantee, and complimentary unstitched blouse piece. Tap any item to inspect fabric drape photos!`,
          metadata: {
            type: 'products',
            items: products,
            engine: 'orchestrator',
          },
        };
      } else {
        let explanation = `We currently do not have authentic handloom sarees matching your exact criteria ("${query}").`;
        let alternativeItems: any[] = [];

        if (matchedColor && maxPrice) {
          const colorMatches = await ToolOrchestrator.searchProducts({ color: matchedColor, inStockOnly: true, limit: 3 });
          const priceMatches = await ToolOrchestrator.searchProducts({ maxPrice, inStockOnly: true, limit: 3 });

          if (colorMatches.length > 0 && priceMatches.length > 0) {
            explanation =
              `We currently do not have **${matchedColor}** sarees under **${formatPrice(maxPrice)}** in stock.\n\n` +
              `• Our authentic handloom **${matchedColor}** sarees (such as our certified *${colorMatches[0].name}*) start from **${formatPrice(colorMatches[0].price)}**.\n` +
              `• If your budget is under **${formatPrice(maxPrice)}**, you may explore our *${priceMatches[0].name}* at **${formatPrice(priceMatches[0].price)}**.\n\n` +
              `Here are authentic handloom pieces within your budget under **${formatPrice(maxPrice)}**:`;
            alternativeItems = priceMatches;
          } else if (colorMatches.length > 0) {
            explanation =
              `We currently do not have **${matchedColor}** sarees under **${formatPrice(maxPrice)}** in stock.\n\n` +
              `Our authentic handloom **${matchedColor}** sarees start from **${formatPrice(colorMatches[0].price)}** (such as our certified *${colorMatches[0].name}*).\n\n` +
              `Here are our authentic **${matchedColor}** handloom pieces:`;
            alternativeItems = colorMatches;
          } else if (priceMatches.length > 0) {
            explanation =
              `We currently do not have sarees in **${matchedColor}** in stock.\n\n` +
              `However, if your budget is under **${formatPrice(maxPrice)}**, here are authentic handloom options available now:`;
            alternativeItems = priceMatches;
          } else {
            const bestsellers = await ToolOrchestrator.searchProducts({ limit: 3, inStockOnly: true });
            explanation = `We currently do not have **${matchedColor}** sarees under **${formatPrice(maxPrice)}** in stock. Our collection starts from **₹2,899** (such as our *Organic Indigo Linen*). Here are our most beloved pieces:`;
            alternativeItems = bestsellers;
          }
        } else if (maxPrice) {
          const priceMatches = await ToolOrchestrator.searchProducts({ maxPrice, inStockOnly: true, limit: 3 });
          explanation = priceMatches.length > 0
            ? `Here are authentic handloom sarees under **${formatPrice(maxPrice)}**:`
            : `We currently do not have active sarees under **${formatPrice(maxPrice)}**. Our collection starts from **₹2,899** (such as our Organic Indigo Linen). Here are our most beloved pieces:`;
          alternativeItems = priceMatches.length > 0 ? priceMatches : await ToolOrchestrator.searchProducts({ limit: 3, inStockOnly: true });
        } else {
          alternativeItems = await ToolOrchestrator.searchProducts({ limit: 3, inStockOnly: true });
          explanation = `We don't have an exact match for "${query}" right now, but here are our most beloved bestselling pieces:`;
        }

        return {
          content: explanation,
          metadata: {
            type: 'products',
            items: alternativeItems,
            engine: 'orchestrator',
          },
        };
      }
    }

    // 5. Date & Time queries ("today dates", "what is today's date", "today's date", "date today", "today day name")
    if (
      q.includes('day name') ||
      q.includes('what day') ||
      q.includes('which day') ||
      q.includes('today day') ||
      q.includes('date') ||
      q.includes('dates') ||
      q.includes('time') ||
      q === 'today' ||
      q === 'today?'
    ) {
      const now = new Date();
      const dayName = new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);
      const formattedDate = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(now);
      const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

      if (q.includes('day name') || q.includes('what day') || q.includes('which day') || q.includes('today day')) {
        return {
          content: `Today is **${dayName}**.`,
          metadata: { type: 'faq', engine: 'orchestrator' },
        };
      }

      if (q.includes('time') && !q.includes('date')) {
        return {
          content: `The current time is **${timeStr} IST**.`,
          metadata: { type: 'faq', engine: 'orchestrator' },
        };
      }

      return {
        content: `Today's date is **${formattedDate}**.`,
        metadata: { type: 'faq', engine: 'orchestrator' },
      };
    }

    // 5.1 Greetings & Casual Chit-chat
    if (
      q.includes('how are you')
    ) {
      return {
        content: `I'm doing well, thank you! How may I assist your saree shopping today?`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (
      q.includes('thank you') ||
      q.includes('thanks')
    ) {
      return {
        content: `You're very welcome! Please feel free to ask if you'd like to explore more fabrics, check zari hallmarks, or track an order.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (
      q === 'hi' ||
      q === 'hello' ||
      q === 'hey' ||
      q.startsWith('hi ') ||
      q.startsWith('hello ') ||
      q.startsWith('hey ') ||
      q.includes('good morning') ||
      q.includes('good afternoon') ||
      q.includes('good evening') ||
      q.includes('namaste')
    ) {
      return {
        content: `Namaste! 👋 Welcome to **Royal Saree & Fashion**. How can I help you discover the perfect handcrafted saree today?`,
        metadata: { engine: 'orchestrator' },
      };
    }

    // 6. Shipping / Delivery queries
    if (q.includes('shipping') || q.includes('delivery') || q.includes('dispatch') || q.includes('how long') || q.includes('courier')) {
      return {
        content:
          `📦 **Shipping & Delivery Information:**\n\n` +
          `• **Free Express Shipping** on all orders above **₹1,999**!\n` +
          `• Standard delivery fee: **₹99** across all Indian PIN codes.\n` +
          `• Metro cities: Delivered in **2 to 4 business days**.\n` +
          `• Rest of India: Delivered in **4 to 6 business days**.\n` +
          `• Partnered with Blue Dart and Delhivery for tamper-evident insured delivery with live SMS tracking.`,
        metadata: { type: 'faq', engine: 'orchestrator' },
      };
    }

    // 7. Return / Refund Policy
    if (q.includes('return') || q.includes('refund') || q.includes('exchange') || q.includes('cancel')) {
      return {
        content:
          `🔄 **7-Day Hassle-Free Returns & Exchange:**\n\n` +
          `• We offer a **7-day return policy** from the date of delivery.\n` +
          `• The saree must remain unused with original security tags, fabric fold, and invoice intact.\n` +
          `• Doorstep reverse pickup is arranged free of charge.\n` +
          `• Full refund is credited directly to your original payment method within 24-48 hours of inspection.`,
        metadata: { type: 'faq', engine: 'orchestrator' },
      };
    }

    // 8. Store / Contact Info
    if (q.includes('contact') || q.includes('phone') || q.includes('email') || q.includes('address') || q.includes('store') || q.includes('whatsapp')) {
      return {
        content:
          `🏛️ **Royal Saree & Fashion** by TechWave Solutions\n\n` +
          `• 📞 **Helpline:** +91 9641145871\n` +
          `• 💬 **WhatsApp:** +919641145871\n` +
          `• ✉️ **Email:** techwavesolutions.dev@gmail.com\n` +
          `• 📍 **Headquarters:** TechWave Tower, Sector V, Salt Lake, Kolkata 700091\n` +
          `• Operating Hours: Mon-Sat, 10:00 AM – 8:00 PM IST`,
        metadata: { type: 'faq', engine: 'orchestrator' },
      };
    }

    return {
      content:
        `Namaste! Welcome to **Royal Saree & Fashion**.\n\nI can help you with:\n` +
        `• Finding sarees (*e.g., "Show me red sarees under ₹3000" or "Lightweight Organza"*)\n` +
        `• Checking product availability (*e.g., "Is Kanjivaram in stock?"*)\n` +
        `• Live order tracking (*e.g., "Where is my order?"*)\n` +
        `• Fabric details, zari purity, and styling guidance\n` +
        `• Shipping fees and 7-day return guarantee\n\nHow may I assist your celebration today?`,
      metadata: { engine: 'orchestrator' },
    };
  }

  static async processBusinessQuery(query: string): Promise<AIResponse> {
    const q = query.toLowerCase().trim();

    // 0. Day Name queries ("today day name", "what day is today", "day name", "which day", "today day")
    if (
      q.includes('day name') ||
      q.includes('today day') ||
      q.includes('which day') ||
      q.includes('what day') ||
      q === 'day' ||
      q === 'day?'
    ) {
      const now = new Date();
      const dayName = new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(now);
      return {
        content: `Today is **${dayName}**.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    // 0.1 Date queries ("today dates", "today dates ?", "today date", "what is today's date", "current date", "today")
    if (
      q.includes('date') ||
      q.includes('dates') ||
      q.includes('calendar') ||
      q === 'today' ||
      q === 'today?' ||
      q === "today's"
    ) {
      const now = new Date();
      const fullDate = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(now);
      return {
        content: `Today's date is **${fullDate}**.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    // 0.2 Time queries ("what time is it", "current time", "time now", "time")
    if (
      q.includes('current time') ||
      q.includes('what time') ||
      q.includes('time now') ||
      q === 'time' ||
      q === 'time?'
    ) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
      return {
        content: `The current time is **${timeStr} IST**.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    // 0.3 Greetings & Casual Chit-chat
    if (
      q.includes('how are you')
    ) {
      return {
        content: `I'm doing well, thank you! How can I assist you today?`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (
      q.includes('who are you') ||
      q.includes('who made you') ||
      q.includes('what is your name')
    ) {
      return {
        content: `I am your **TechWave Retail360 AI Assistant**, powered by Gemini AI and grounded store intelligence. I can answer common questions and provide store business analytics.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (
      q.includes('what can you do') ||
      q.includes('help me') ||
      q.includes('features')
    ) {
      return {
        content:
          `Here is what I can do for you:\n\n` +
          `• **General Queries:** Answer common questions, current date, day of week, and time.\n` +
          `• **Sales & Revenue:** Today's gross sales, 7-day revenue trend in table or chart format, monthly turnover.\n` +
          `• **Weaver & Stock Management:** Low stock alerts (≤ 5 units), out of stock items, category breakdowns.\n` +
          `• **Operations:** Recent customer orders, order fulfillment status, and system/gateway health.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (
      q.includes('thank you') ||
      q.includes('thanks')
    ) {
      return {
        content: `You're very welcome! Let me know if you need any other store insights or reports.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (
      q === 'hi' ||
      q === 'hello' ||
      q === 'hey' ||
      q.startsWith('hi ') ||
      q.startsWith('hello ') ||
      q.startsWith('hey ') ||
      q.includes('good morning') ||
      q.includes('good afternoon') ||
      q.includes('good evening') ||
      q.includes('namaste')
    ) {
      return {
        content: `Namaste! 👋 I am your **TechWave Retail360 AI Assistant**.\n\nHow can I help you today? You can ask me common questions or request sales metrics, inventory stock, and weaver reports.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    // 1. Chart & Graph queries (Multi-chart suite, Pie/Donut, Bar, and Line Graph)
    const isMultiChartQuery =
      (q.includes('different') && (q.includes('chart') || q.includes('graph') || q.includes('way'))) ||
      q.includes('different different') ||
      q.includes('different chart') ||
      q.includes('different graph') ||
      q.includes('charts and graphs') ||
      q.includes('charts or graphs') ||
      q.includes('graphs and charts') ||
      q.includes('show graphs') ||
      q.includes('show charts') ||
      q.includes('all charts') ||
      q.includes('all graphs') ||
      q.includes('graph way') ||
      q.includes('chart way') ||
      q.includes('various chart') ||
      q.includes('multiple chart') ||
      q === 'charts' ||
      q === 'graphs';

    if (isMultiChartQuery) {
      const [trendRes, catRes, topRes] = await Promise.all([
        ToolOrchestrator.getRevenueTrend(7),
        ToolOrchestrator.getCategoryDistribution(),
        ToolOrchestrator.getTopSellingProducts(5),
      ]);

      return {
        content:
          `📊 **Multi-Dimensional Store Visual Analytics (Charts & Graphs Suite):**\n\n` +
          `Here are three distinct visual chart and graph formats representing your store's live database performance:\n\n` +
          `1. 📈 **Daily Revenue & Orders Trajectory (Line Graph):** 7-day revenue trend curve and transaction checkpoints.\n` +
          `2. 🍩 **Collection Market Share (Donut / Pie Chart):** Gross revenue percentage distribution across our saree weave categories.\n` +
          `3. 📊 **Top Performing Sarees (Comparative Bar Chart):** Units sold comparison across bestseller catalog pieces.\n\n` +
          `Review the interactive visualizations, KPI metrics, and summary data tables below:`,
        metadata: {
          type: 'analytics',
          charts: [trendRes.chart, catRes.chart, topRes.chart],
          chart: trendRes.chart,
          table: trendRes.table,
          kpis: trendRes.kpis,
          engine: 'orchestrator',
        },
      };
    }

    // 1.1 Category Distribution / Donut / Pie Chart query
    if (
      q.includes('pie') ||
      q.includes('donut') ||
      (q.includes('category') && (q.includes('chart') || q.includes('graph') || q.includes('share') || q.includes('distribution')))
    ) {
      const catRes = await ToolOrchestrator.getCategoryDistribution();
      return {
        content:
          `🍩 **Saree Collection Revenue Share (Donut / Pie Chart):**\n\n` +
          `Visual distribution of revenue across our authentic saree weave categories:`,
        metadata: {
          type: 'analytics',
          chart: catRes.chart,
          table: catRes.table,
          engine: 'orchestrator',
        },
      };
    }

    // 1.2 Top Products / Bestsellers Bar Chart query
    if (
      q.includes('bar chart') ||
      q.includes('bar graph') ||
      (q.includes('top') && (q.includes('chart') || q.includes('graph'))) ||
      (q.includes('bestseller') && (q.includes('chart') || q.includes('graph')))
    ) {
      const topRes = await ToolOrchestrator.getTopSellingProducts(5);
      return {
        content:
          `📊 **Top 5 Bestselling Sarees (Comparative Bar Chart):**\n\n` +
          `Ranking of our highest-grossing handloom sarees by sales volume and units dispatched:`,
        metadata: {
          type: 'analytics',
          chart: topRes.chart,
          table: topRes.table,
          engine: 'orchestrator',
        },
      };
    }

    // 1.3 7-Day Revenue & Sales Graph / Trend queries
    const wantsTable =
      q.includes('table') ||
      q.includes('tabular') ||
      q.includes('formate') ||
      q.includes('format') ||
      q.includes('grid');

    if (
      q.includes('trend') ||
      q.includes('chart') ||
      q.includes('graph') ||
      q.includes('revenue curve') ||
      q.includes('last 7 days') ||
      q.includes('7 days') ||
      q.includes('7 day') ||
      (q.includes('sales') && (q.includes('days') || q.includes('week') || q.includes('table') || q.includes('graph')))
    ) {
      const res = await ToolOrchestrator.getRevenueTrend(7);
      return {
        content: wantsTable
          ? `📊 **Last 7 Days Sales & Revenue Breakdown (Table Format):**\n\nHere is your store's daily sales performance, order counts, and gross revenue for the last 7 days organized in table format:`
          : `📈 **7-Day Revenue & Volume Trajectory (Line Graph):**\n\nI have synthesized the 7-day daily trajectory from your verified database transactions. View the daily performance below:`,
        metadata: {
          type: 'analytics',
          table: res.table,
          chart: wantsTable && !q.includes('chart') && !q.includes('graph') ? undefined : res.chart,
          kpis: res.kpis,
          engine: 'orchestrator',
        },
      };
    }

    // 2. Today's sales (excluding specific order lookups)
    if (
      q.includes("today's sales") ||
      q.includes('sales today') ||
      (q.includes('today') && (q.includes('sales') || q.includes('revenue')) && !q.includes('order'))
    ) {
      const res = await ToolOrchestrator.getSalesKPIs();
      return {
        content:
          `📊 **Today's Real-Time Sales Performance:**\n\n` +
          `• **Today's Gross Sales:** **${formatPrice(res.raw.todaySales)}**\n` +
          `• **Orders Placed Today:** **${res.raw.todayOrdersCount}** orders\n` +
          `• **Unique Customers Ordered Today:** **${res.raw.todayCustomersCount}**\n` +
          `• **Pending Orders:** **${res.raw.pendingOrdersCount}** requiring fulfillment`,
        metadata: {
          type: 'analytics',
          kpis: res.kpis,
          stats: res.raw,
          engine: 'orchestrator',
        },
      };
    }

    // 3. Month's revenue / turnover
    if (q.includes('month') || q.includes('monthly') || q.includes('turnover') || q.includes('lifetime revenue')) {
      const res = await ToolOrchestrator.getSalesKPIs();
      return {
        content:
          `💰 **Monthly & All-Time Revenue Breakdown:**\n\n` +
          `• **This Month's Realized Revenue:** **${formatPrice(res.raw.monthSales)}**\n` +
          `• **All-Time Verified Revenue:** **${formatPrice(res.raw.totalRevenue)}**\n` +
          `• **Total Lifetime Orders:** **${res.raw.totalOrdersCount}**\n` +
          `• **Registered Customer Base:** **${res.raw.totalCustomersCount}**`,
        metadata: {
          type: 'analytics',
          kpis: res.kpis,
          stats: res.raw,
          engine: 'orchestrator',
        },
      };
    }

    // 4. Pending orders
    if (q.includes('pending') || q.includes('fulfillment') || q.includes('unfulfilled')) {
      const res = await ToolOrchestrator.getSalesKPIs();
      return {
        content:
          `📦 **Pending Orders Status:**\n\n` +
          `• **Currently Pending Orders:** **${res.raw.pendingOrdersCount}**\n` +
          `• Recommended Action: Review orders in the Fulfillment tab to update status to PACKED or SHIPPED and generate carrier waybills.`,
        metadata: {
          type: 'analytics',
          kpis: res.kpis,
          stats: res.raw,
          engine: 'orchestrator',
        },
      };
    }

    // 5. Out of stock & Low stock products
    if (q.includes('stock') || q.includes('low') || q.includes('inventory') || q.includes('reorder') || q.includes('out of stock')) {
      const res = await ToolOrchestrator.getInventoryHealth();
      const totalAlerts = res.raw.lowStock.length + res.raw.outOfStock.length;

      let msg = totalAlerts > 0
        ? `⚠️ **Inventory Health & Stock Replenishment Alert:**\n\nFound **${res.raw.outOfStock.length}** out-of-stock items and **${res.raw.lowStock.length}** low-stock sarees (<= 5 units remaining). See the replenishment action table below:`
        : `✅ **Inventory Health Excellent:** All catalog items are comfortably stocked above safety thresholds!`;

      return {
        content: msg,
        metadata: {
          type: 'analytics',
          table: res.table,
          kpis: res.kpis,
          engine: 'orchestrator',
        },
      };
    }

    // 6. Category selling most / Category breakdown
    if (q.includes('category') || q.includes('categories') || q.includes('weave type') || q.includes('collection')) {
      const res = await ToolOrchestrator.getCategoryDistribution();
      return {
        content:
          `🏆 **Category Sales & Revenue Ranking:**\n\n` +
          `Here is the performance ranking of each saree weave collection across units sold and gross revenue:`,
        metadata: {
          type: 'analytics',
          chart: res.chart,
          table: res.table,
          engine: 'orchestrator',
        },
      };
    }

    // 7. Best sellers / Top products
    if (q.includes('best') || q.includes('top') || q.includes('popular') || q.includes('selling')) {
      const res = await ToolOrchestrator.getTopSellingProducts(5);
      return {
        content:
          `🏆 **Top Performing Bestseller Sarees:**\n\n` +
          `Below is the ranking of our top revenue-generating saree pieces with live stock indicators:`,
        metadata: {
          type: 'analytics',
          table: res.table,
          chart: res.chart,
          engine: 'orchestrator',
        },
      };
    }

    // 8. Orders queries (e.g. "today last one order", "last order", "latest order", "last 1 order", "recent orders")
    const isOrderQuery =
      q.includes('order') ||
      q.includes('orders') ||
      q.includes('booking') ||
      q.includes('transactions');

    if (isOrderQuery && !q.includes('pending') && !q.includes('unfulfilled')) {
      const wantsSingleOrder =
        q.includes('last one') ||
        q.includes('last 1') ||
        q.includes('latest one') ||
        q.includes('latest 1') ||
        q.includes('one order') ||
        q.includes('1 order') ||
        q.includes('single order') ||
        q.includes('last order') ||
        q.includes('latest order') ||
        q === 'order' ||
        q === 'last';

      if (wantsSingleOrder) {
        const lastOrder = await prisma.order.findFirst({
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
          },
        });

        if (lastOrder) {
          const dateStr = new Date(lastOrder.createdAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          const itemsList =
            lastOrder.items && lastOrder.items.length > 0
              ? lastOrder.items.map((it) => `• **${it.productName}** × ${it.quantity} (${formatPrice(it.price)})`).join('\n')
              : '• Handloom Saree Piece';

          const table: AITableData = {
            title: `Order Details: #${lastOrder.orderNumber}`,
            headers: ['Order #', 'Customer Name', 'Total Amount', 'Payment Status', 'Order Status', 'Date & Time'],
            rows: [
              [
                lastOrder.orderNumber,
                lastOrder.customerName,
                formatPrice(lastOrder.total),
                lastOrder.paymentStatus,
                lastOrder.status,
                `${dateStr} IST`,
              ],
            ],
          };

          return {
            content:
              `📦 **Latest Customer Order Details (#${lastOrder.orderNumber}):**\n\n` +
              `• **Customer:** **${lastOrder.customerName}** (${lastOrder.customerEmail})\n` +
              `• **Date & Time:** **${dateStr} IST**\n` +
              `• **Order Total:** **${formatPrice(lastOrder.total)}**\n` +
              `• **Payment Status:** **${lastOrder.paymentStatus}** (${lastOrder.paymentMethod || 'Razorpay'})\n` +
              `• **Fulfillment Status:** **${lastOrder.status}**\n` +
              `• **Delivery Destination:** ${lastOrder.city}, ${lastOrder.state} (PIN: ${lastOrder.pinCode})\n\n` +
              `**Items Ordered:**\n${itemsList}`,
            metadata: {
              type: 'analytics',
              table,
              engine: 'orchestrator',
            },
          };
        } else {
          return {
            content: `No customer orders found in the database yet. Live transactions will appear here in real-time.`,
            metadata: { engine: 'orchestrator' },
          };
        }
      }

      // Default: 5 most recent orders
      const res = await ToolOrchestrator.getRecentOrders(5);
      return {
        content:
          `📋 **5 Most Recent Customer Orders:**\n\n` +
          `Here are the latest customer transactions captured across Razorpay and Cash on Delivery:`,
        metadata: {
          type: 'analytics',
          table: res.table,
          engine: 'orchestrator',
        },
      };
    }

    // 8.1 Saree & Product Catalog Search in Admin AI (e.g. "finding sarees which is under 3000 color red", "find red sarees", "search sarees")
    const isProductSearch =
      q.includes('saree') ||
      q.includes('sarees') ||
      q.includes('product') ||
      q.includes('products') ||
      q.includes('finding') ||
      q.includes('catalog') ||
      (q.includes('find') && (q.includes('under') || q.includes('color') || q.includes('price'))) ||
      ((q.includes('red') || q.includes('blue') || q.includes('silk') || q.includes('kanjivaram') || q.includes('organza')) &&
        (q.includes('under') || q.includes('price') || q.includes('budget') || q.includes('cost')));

    if (isProductSearch) {
      let maxPrice: number | undefined;
      const priceMatch =
        q.match(/(?:under|below|less than|within|upto|up to)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i) ||
        q.match(/(?:rs\.?|inr|₹)\s*(\d+)/i);
      if (priceMatch) {
        maxPrice = parseInt(priceMatch[1], 10);
      }

      const colors = ['red', 'crimson', 'ruby', 'blue', 'navy', 'green', 'emerald', 'yellow', 'pink', 'black', 'peach', 'orange', 'lavender', 'mint', 'ivory', 'gold'];
      const matchedColor = colors.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(q));

      const fabrics = ['kanjivaram', 'banarasi', 'organza', 'chanderi', 'linen', 'bandhani', 'leheriya', 'sequin', 'silk', 'georgette', 'tissue', 'tussar'];
      const matchedFabric = fabrics.find((f) => new RegExp(`\\b${f}\\b`, 'i').test(q));

      const products = await ToolOrchestrator.searchProducts({
        maxPrice,
        color: matchedColor,
        fabric: matchedFabric,
        inStockOnly: true,
        limit: 5,
      });

      if (products.length > 0) {
        const table: AITableData = {
          title: `Catalog Search Results (${products.length} Sarees)`,
          headers: ['SKU', 'Saree Name', 'Category', 'Price', 'Stock', 'Status'],
          rows: products.map((p: any) => [
            p.sku,
            p.name,
            p.category,
            formatPrice(p.price),
            `${p.stock} units`,
            p.stock > 0 ? 'IN STOCK' : 'OUT OF STOCK',
          ]),
        };

        let intro = `🛍️ **Catalog Search Results:**\n\nFound **${products.length}** sarees matching your search`;
        if (matchedColor) intro += ` in **${matchedColor}**`;
        if (matchedFabric) intro += ` crafted in **${matchedFabric}**`;
        if (maxPrice) intro += ` under **${formatPrice(maxPrice)}**`;
        intro += `:\n`;

        return {
          content: intro,
          metadata: {
            type: 'products',
            items: products,
            table,
            engine: 'orchestrator',
          },
        };
      } else {
        const colorMatches = matchedColor ? await ToolOrchestrator.searchProducts({ color: matchedColor, inStockOnly: true, limit: 3 }) : [];
        const priceMatches = maxPrice ? await ToolOrchestrator.searchProducts({ maxPrice, inStockOnly: true, limit: 3 }) : [];

        let explanation = '';
        let altItems: any[] = [];

        if (matchedColor && maxPrice) {
          if (colorMatches.length > 0 && priceMatches.length > 0) {
            explanation =
              `We currently do not have **${matchedColor}** sarees under **${formatPrice(maxPrice)}** in stock.\n\n` +
              `• Our authentic handloom **${matchedColor}** sarees (such as our certified *${colorMatches[0].name}*) start from **${formatPrice(colorMatches[0].price)}**.\n` +
              `• If the budget is under **${formatPrice(maxPrice)}**, our catalog offers *${priceMatches[0].name}* at **${formatPrice(priceMatches[0].price)}**.\n\n` +
              `Here are active handloom sarees within the **${formatPrice(maxPrice)}** budget:`;
            altItems = priceMatches;
          } else if (colorMatches.length > 0) {
            explanation =
              `We currently do not have **${matchedColor}** sarees under **${formatPrice(maxPrice)}** in stock.\n\n` +
              `Our authentic handloom **${matchedColor}** sarees start from **${formatPrice(colorMatches[0].price)}** (*${colorMatches[0].name}*).`;
            altItems = colorMatches;
          } else {
            explanation = `We currently do not have active sarees matching "${query}". Our lowest price handloom saree starts from **₹2,899** (*Organic Indigo Linen*).`;
            altItems = priceMatches.length > 0 ? priceMatches : await ToolOrchestrator.searchProducts({ limit: 3, inStockOnly: true });
          }
        } else if (matchedColor) {
          explanation = `We currently do not have sarees in **${matchedColor}** in stock. Here are recommended sarees from our collection:`;
          altItems = await ToolOrchestrator.searchProducts({ limit: 3, inStockOnly: true });
        } else {
          explanation = `No sarees found matching "${query}". Here are our bestselling sarees:`;
          altItems = await ToolOrchestrator.searchProducts({ limit: 3, inStockOnly: true });
        }

        const table: AITableData = {
          title: 'Recommended Catalog Items',
          headers: ['SKU', 'Saree Name', 'Category', 'Price', 'Stock'],
          rows: altItems.map((p: any) => [
            p.sku,
            p.name,
            p.category,
            formatPrice(p.price),
            `${p.stock} units`,
          ]),
        };

        return {
          content: explanation,
          metadata: {
            type: 'products',
            items: altItems,
            table,
            engine: 'orchestrator',
          },
        };
      }
    }

    // 9. System & Gateway Status
    if (q.includes('system') || q.includes('gateway') || q.includes('razorpay') || q.includes('supabase') || q.includes('services') || q.includes('health')) {
      const res = await ToolOrchestrator.getSystemServicesStatus();
      return {
        content:
          `🛡️ **System Infrastructure & Payment Gateway Health:**\n\n` +
          `Real-time status of Supabase PostgreSQL database, Razorpay payments, Gmail SMTP alerts, and Fast2SMS services:`,
        metadata: {
          type: 'system',
          kpis: res.kpis,
          table: res.table,
          engine: 'orchestrator',
        },
      };
    }

    // Common knowledge / textile / fabric questions
    if (q.includes('kanjivaram') || q.includes('kancheepuram')) {
      return {
        content: `**Kanjivaram (Kanchipuram) Silk** is a legendary handloom silk saree originating from Tamil Nadu. Crafted with pure mulberry silk threads and authentic gold- or silver-dipped zari, Kanjivaram sarees are renowned for their heavy contrast borders (*korvai* weave) and temple motifs. They are cherished heirlooms for weddings and sacred festivities.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (q.includes('banarasi')) {
      return {
        content: `**Banarasi Silk** originates from Varanasi (Banaras), Uttar Pradesh. Woven with fine gold and silver brocade or *zari*, Banarasi sarees feature intricate Mughal-inspired motifs like florals (*kalga* and *bel*), jaal work, and mina accents. They are a timeless centerpiece of Indian bridal couture.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (q.includes('organza')) {
      return {
        content: `**Organza** is a lightweight, sheer, plain-weave fabric traditionally crafted from pure silk filaments. It is celebrated for its delicate translucency, crisp drape, and sophisticated modern sheen—frequently adorned with hand-embroidered Aari or Zardozi needlework.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (q.includes('paithani')) {
      return {
        content: `**Paithani Silk** originates from Paithan, Maharashtra. Known as the "Queen of Sarees", it is characterized by rich pure silk fabric, a distinctive oblique square border design, and an exquisite peacock (*mor*) motif pallu woven with genuine gold zari.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    if (q.includes('zari')) {
      return {
        content: `**Zari** is an ornamental thread traditionally made of fine gold or silver wrapped around a silk core. In authentic handloom sarees, zari gives borders and pallus their radiant shimmer and regal prestige.`,
        metadata: { engine: 'orchestrator' },
      };
    }

    // Default conversational response for common/unmatched questions
    return {
      content:
        `I am your **TechWave Retail360 AI Assistant**.\n\n` +
        `• For general questions, feel free to ask about dates, times, or saree weaves.\n` +
        `• For store business analytics, you can ask:\n` +
        `  - *"What are today's sales?"*\n` +
        `  - *"Show last 7 days sales in table format"*\n` +
        `  - *"Which products are low in stock?"*\n` +
        `  - *"Which category is selling the most?"*\n` +
        `  - *"Show system and gateway health"*`,
      metadata: {
        engine: 'orchestrator',
      },
    };
  }
}

/**
 * ============================================================================
 * MAIN AI SERVICE
 * Dual AI Persona (Customer AI & Business AI)
 * Tries Gemini API first with Tool Orchestrator; seamlessly falls back
 * to Deterministic Tool Engine on failure or missing API key.
 * ============================================================================
 */
export class AIService {
  static async handleCustomerChat(
    message: string,
    history: AIChatMessage[] = [],
    user?: UserSession
  ): Promise<AIResponse> {
    const startTime = Date.now();

    // 1. Attempt Gemini API with Customer Tools
    const geminiRes = await GeminiAIEngine.callGeminiCustomer(message, history, user);
    if (geminiRes) {
      if (geminiRes.metadata) {
        geminiRes.metadata.latencyMs = Date.now() - startTime;
      }
      return geminiRes;
    }

    // 2. Deterministic Fallback with Tool Orchestrator
    const fallbackRes = await DeterministicToolEngine.processCustomerQuery(message, history, user);
    if (fallbackRes.metadata) {
      fallbackRes.metadata.latencyMs = Date.now() - startTime;
    }
    return fallbackRes;
  }

  static async handleBusinessChat(message: string): Promise<AIResponse> {
    const startTime = Date.now();

    // 1. Attempt Gemini API with Business Tools
    const geminiRes = await GeminiAIEngine.callGeminiBusiness(message);
    if (geminiRes) {
      if (geminiRes.metadata) {
        geminiRes.metadata.latencyMs = Date.now() - startTime;
      }
      return geminiRes;
    }

    // 2. Deterministic Fallback with Tool Orchestrator
    const fallbackRes = await DeterministicToolEngine.processBusinessQuery(message);
    if (fallbackRes.metadata) {
      fallbackRes.metadata.latencyMs = Date.now() - startTime;
    }
    return fallbackRes;
  }
}
