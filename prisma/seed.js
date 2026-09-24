const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding TechWave Retail360 database...');

  // 1. Clean existing data
  await prisma.aiMessage.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productAttribute.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  // 2. Settings
  const defaultSettings = [
    { key: 'STORE_NAME', value: 'Royal Saree & Fashion', description: 'Store Display Name' },
    { key: 'STORE_TAGLINE', value: 'Build • Innovate • Transform', description: 'Brand Tagline' },
    { key: 'STORE_PHONE', value: '+91 9641145871', description: 'Contact Phone Number' },
    { key: 'STORE_EMAIL', value: 'techwavesolutions.dev@gmail.com', description: 'Support Email' },
    { key: 'WHATSAPP_PHONE', value: '+919641145871', description: 'WhatsApp Business Number' },
    { key: 'STORE_ADDRESS', value: 'TechWave Tower, Sector V, Salt Lake, Kolkata, West Bengal 700091', description: 'Registered Address' },
    { key: 'CURRENCY', value: 'INR', description: 'Default Currency' },
    { key: 'CURRENCY_SYMBOL', value: '₹', description: 'Currency Symbol' },
    { key: 'SHIPPING_FEE', value: '99', description: 'Standard Delivery Charge' },
    { key: 'FREE_SHIPPING_THRESHOLD', value: '1999', description: 'Minimum order amount for free delivery' },
    { key: 'TAX_RATE', value: '5', description: 'GST rate on textiles (%)' },
    { key: 'LOW_STOCK_GLOBAL_THRESHOLD', value: '5', description: 'Threshold to trigger low stock warning' },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.create({ data: s });
  }

  // 3. Create Admin & Customer Users
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const customerPasswordHash = await bcrypt.hash('customer123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@royal.techwavesolutions.dev',
      name: 'Prakash Roy (Store Admin)',
      phone: '+91 9641145871',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      profile: {
        create: {
          bio: 'Head of Operations at Royal Saree & Fashion powered by TechWave Solutions',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
        },
      },
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      email: 'priya.sharma@example.com',
      name: 'Priya Sharma',
      phone: '+91 9830123456',
      passwordHash: customerPasswordHash,
      role: 'CUSTOMER',
      profile: {
        create: {
          bio: 'Saree connoisseur & classic handloom collector',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300',
        },
      },
      addresses: {
        create: [
          {
            name: 'Priya Sharma',
            phone: '+91 9830123456',
            streetAddress: 'Flat 4B, Silver Oak Residency, Southern Avenue',
            city: 'Kolkata',
            state: 'West Bengal',
            pinCode: '700029',
            country: 'India',
            isDefault: true,
          },
        ],
      },
    },
  });

  // 4. Categories
  const categoriesData = [
    {
      name: 'Kanjivaram Silk',
      slug: 'kanjivaram-silk',
      description: 'Handwoven pure mulberry silk sarees with exquisite pure gold and silver zari borders.',
      image: 'https://images.pexels.com/photos/1488312/pexels-photo-1488312.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 1,
    },
    {
      name: 'Banarasi Brocade',
      slug: 'banarasi-brocade',
      description: 'Timeless Varanasi handlooms featuring opulent floral jaal, kadwa weaves, and regal pallus.',
      image: 'https://images.pexels.com/photos/3321793/pexels-photo-3321793.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 2,
    },
    {
      name: 'Organza & Floral',
      slug: 'organza-floral',
      description: 'Weightless, sheer organza sarees with delicate botanical hand-paint and scalloped gota patti.',
      image: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 3,
    },
    {
      name: 'Chanderi & Linen',
      slug: 'chanderi-linen',
      description: 'Breathable, lightweight handlooms crafted for effortless grace, boardrooms, and daytime ceremonies.',
      image: 'https://images.pexels.com/photos/2220316/pexels-photo-2220316.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 4,
    },
    {
      name: 'Bandhani & Leheriya',
      slug: 'bandhani-leheriya',
      description: 'Vibrant Rajasthani & Gujarati tie-and-dye masterworks celebrating festive joy and cultural heritage.',
      image: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 5,
    },
    {
      name: 'Party & Cocktail Wear',
      slug: 'party-cocktail-wear',
      description: 'Contemporary drape sarees, sequins, and pre-stitched party pieces designed for modern elegance.',
      image: 'https://images.pexels.com/photos/247287/pexels-photo-247287.jpeg?auto=compress&cs=tinysrgb&w=800',
      sortOrder: 6,
    },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.create({ data: cat });
    categoryMap[cat.slug] = created.id;
  }

  // 5. Rich Products (21 authentic saree & fashion products)
  const productsData = [
    {
      name: 'Royal Crimson Kanjivaram Silk Saree',
      slug: 'royal-crimson-kanjivaram-silk',
      description: 'An authentic masterpiece handwoven by master artisans in Kanchipuram. Woven from 100% pure mulberry silk, this bridal red saree features dense gold zari motifs across the body, a majestic korvai temple border, and a rich brocade pallu. Accompanied by a complementary pure silk unstitched blouse piece.',
      shortDescription: 'Pure mulberry silk with real gold zari temple border and heavy brocade pallu.',
      categorySlug: 'kanjivaram-silk',
      price: 18499,
      discountPrice: 14999,
      sku: 'RSF-KANJI-001',
      stock: 14,
      lowStockThreshold: 4,
      isFeatured: true,
      isBestseller: true,
      tags: 'kanjivaram, silk, bridal, red, wedding, gold zari',
      images: [
        '/images/products/saree-crimson-royal.jpg',
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: '100% Pure Mulberry Silk' },
        { name: 'Color', value: 'Deep Crimson Red' },
        { name: 'Zari Type', value: 'Pure Gold & Silver Tested Zari' },
        { name: 'Occasion', value: 'Bridal, Wedding, Grand Celebrations' },
        { name: 'Blouse Piece', value: 'Included (0.8m unstitched matching silk)' },
        { name: 'Saree Length', value: '5.5 meters' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Emerald Peacock Kanjivaram Weave Saree',
      slug: 'emerald-peacock-kanjivaram-weave',
      description: 'Draped in regal splendor, this emerald green Kanjivaram features traditional peacock (mayil) and chakra motifs hand-woven into shimmering gold tissue zari. The contrasting magenta pallu creates an unforgettable royal impression.',
      shortDescription: 'Emerald green silk with peacock motifs and contrast magenta royal pallu.',
      categorySlug: 'kanjivaram-silk',
      price: 15999,
      discountPrice: 12499,
      sku: 'RSF-KANJI-002',
      stock: 8,
      lowStockThreshold: 3,
      isFeatured: true,
      isBestseller: false,
      tags: 'kanjivaram, emerald green, peacock motif, contrast pallu',
      images: [
        '/images/products/saree-emerald-peacock.jpg',
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Pure Kanchipuram Silk' },
        { name: 'Color', value: 'Emerald Green with Magenta Border' },
        { name: 'Pattern', value: 'Peacock & Chakra Motifs' },
        { name: 'Occasion', value: 'Reception, Festive Pujas' },
        { name: 'Blouse Piece', value: 'Included (Contrast Magenta 0.8m)' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Varanasi Royal Navy Kadwa Banarasi Saree',
      slug: 'varanasi-royal-navy-kadwa-banarasi',
      description: 'Crafted over 45 days on traditional pit looms in Varanasi, this midnight navy Banarasi showcases authentic kadwa weaving where each floral buta is individually etched without loose floating threads on the reverse. Soft drape with antique gold sheen.',
      shortDescription: 'Authentic Banarasi kadwa handloom in midnight navy with antique gold floral butis.',
      categorySlug: 'banarasi-brocade',
      price: 13999,
      discountPrice: 10999,
      sku: 'RSF-BANAR-001',
      stock: 12,
      lowStockThreshold: 4,
      isFeatured: true,
      isBestseller: true,
      tags: 'banarasi, navy blue, kadwa, wedding, luxury',
      images: [
        '/images/products/saree-navy-kadwa.jpg',
        'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Pure Katan Silk' },
        { name: 'Color', value: 'Midnight Navy Blue' },
        { name: 'Weave', value: 'Handloom Kadwa Floral Jaal' },
        { name: 'Occasion', value: 'Cocktail, Wedding Guest, Evening Gala' },
        { name: 'Blouse Piece', value: 'Running Silk Blouse with Border (0.8m)' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Vintage Gulab Pink Banarasi Tanchoi Saree',
      slug: 'vintage-gulab-pink-banarasi-tanchoi',
      description: 'An ethereal creation woven in delicate satin-silk tanchoi weave. The self-embossed floral tapestry reflects an iridescent pearlescent sheen under lighting. Unmatched lightweight comfort combined with high Banarasi prestige.',
      shortDescription: 'Pastel rose pink satin silk tanchoi with fine self-woven floral tapestry.',
      categorySlug: 'banarasi-brocade',
      price: 11499,
      discountPrice: 8999,
      sku: 'RSF-BANAR-002',
      stock: 3, // LOW STOCK FOR ALERT
      lowStockThreshold: 5,
      isFeatured: false,
      isBestseller: true,
      tags: 'tanchoi, banarasi, pink, pastel, festive',
      images: [
        '/images/products/saree-rose-tanchoi.jpg',
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Tanchoi Satin Silk' },
        { name: 'Color', value: 'Pastel Rose Pink' },
        { name: 'Pattern', value: 'Self-embossed Floral Tapestry' },
        { name: 'Occasion', value: 'Day Weddings, Sangeet, Engagements' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Powder Blue Scallop Hand-Painted Organza Saree',
      slug: 'powder-blue-scallop-hand-painted-organza',
      description: 'Whisper-light Italian-finish pure silk organza adorned with hand-painted watercolor meadow blooms in peach and lavender tones. Embellished with meticulous hand-cut scalloped borders highlighted with subtle silver cut-dana work.',
      shortDescription: 'Pure silk organza with watercolor botanical hand-painting and hand-cut scalloped border.',
      categorySlug: 'organza-floral',
      price: 6499,
      discountPrice: 4999,
      sku: 'RSF-ORGAN-001',
      stock: 18,
      lowStockThreshold: 5,
      isFeatured: true,
      isBestseller: true,
      tags: 'organza, powder blue, hand painted, scallop, modern luxury',
      images: [
        'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Pure Silk Organza' },
        { name: 'Color', value: 'Powder Blue' },
        { name: 'Craft', value: 'Botanical Watercolor Hand-Paint' },
        { name: 'Border', value: 'Hand-Cut Scallop with Cut-dana' },
        { name: 'Occasion', value: 'Brunch, Destination Wedding, Mehndi' },
        { name: 'Blouse Piece', value: 'Unstitched Raw Silk Blouse Piece Included' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Blush Pearl Embroidered Organza Saree',
      slug: 'blush-pearl-embroidered-organza',
      description: 'Subtle sophistication in translucent blush pink organza. Finely adorned with ivory threadwork florals, delicate micro-sequins, and a pristine pearl-beaded border that catches every glimmer of twilight.',
      shortDescription: 'Translucent blush organza with tone-on-tone embroidery and pearl edging.',
      categorySlug: 'organza-floral',
      price: 7299,
      discountPrice: 5799,
      sku: 'RSF-ORGAN-002',
      stock: 6,
      lowStockThreshold: 4,
      isFeatured: false,
      isBestseller: false,
      tags: 'organza, blush pink, pearl work, delicate',
      images: [
        'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Semi-sheer Organza Silk' },
        { name: 'Color', value: 'Blush Pearl' },
        { name: 'Occasion', value: 'Cocktail, Evening Soiree, Engagement' },
        { name: 'Blouse Piece', value: 'Embroidered Art Silk Blouse (0.8m)' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Ivory & Gold Zari Chanderi Silk Saree',
      slug: 'ivory-gold-zari-chanderi-silk',
      description: 'Woven in the historic looms of Madhya Pradesh, this regal Chanderi combines high-twist cotton and mulberry silk yarns. Decorated with signature coin (ashrafi) motifs and a classic narrow gold border.',
      shortDescription: 'Feather-light Chanderi silk cotton with golden ashrafi butas and temple border.',
      categorySlug: 'chanderi-linen',
      price: 4999,
      discountPrice: 3899,
      sku: 'RSF-CHAND-001',
      stock: 22,
      lowStockThreshold: 5,
      isFeatured: true,
      isBestseller: false,
      tags: 'chanderi, ivory, gold zari, handloom, breathable',
      images: [
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Handwoven Chanderi (Silk by Cotton)' },
        { name: 'Color', value: 'Pristine Ivory Gold' },
        { name: 'Motifs', value: 'Ashrafi (Coin) Butas' },
        { name: 'Occasion', value: 'Office Festive, Poojas, Festive Gatherings' },
        { name: 'Blouse Piece', value: 'Running Chanderi with Border (0.8m)' },
        { name: 'Care', value: 'Hand wash gently or dry clean' },
      ],
    },
    {
      name: 'Organic Indigo Linen Zari Handloom Saree',
      slug: 'organic-indigo-linen-zari-handloom',
      description: 'Crafted from 100-count premium European flax linen yarn, natural indigo-dyed with an understated metallic silver zari border. Softens luxuriously with every wash, offering supreme all-day comfort.',
      shortDescription: '100-count natural indigo flax linen with silver zari stripes and tasselled pallu.',
      categorySlug: 'chanderi-linen',
      price: 3699,
      discountPrice: 2899,
      sku: 'RSF-LINEN-001',
      stock: 16,
      lowStockThreshold: 4,
      isFeatured: false,
      isBestseller: true,
      tags: 'linen, indigo, organic, daily luxury, summer',
      images: [
        'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: '100% Pure Organic Linen (100 Count)' },
        { name: 'Color', value: 'Natural Indigo' },
        { name: 'Border', value: 'Silver Zari Selvedge' },
        { name: 'Occasion', value: 'Corporate, Gallery Openings, Summer Parties' },
        { name: 'Blouse Piece', value: 'Solid Indigo Linen (0.8m)' },
        { name: 'Care', value: 'Gentle Hand Wash or Machine Delicates' },
      ],
    },
    {
      name: 'Marigold Yellow Traditional Bandhani Georgette Saree',
      slug: 'marigold-yellow-traditional-bandhani-georgette',
      description: 'Intricately hand-knotted by traditional artisans of Kutch using genuine raas bandhej techniques. The joyous yellow and vermillion red combination is highlighted with fine gota patti lace border work.',
      shortDescription: 'Pure viscose georgette with fine artisanal bandhej knots and radiant gota border.',
      categorySlug: 'bandhani-leheriya',
      price: 5499,
      discountPrice: 4199,
      sku: 'RSF-BANDH-001',
      stock: 15,
      lowStockThreshold: 4,
      isFeatured: true,
      isBestseller: true,
      tags: 'bandhani, yellow, haldi, gota patti, kutch',
      images: [
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Pure Viscose Georgette' },
        { name: 'Color', value: 'Marigold Yellow with Vermillion' },
        { name: 'Craft', value: 'Authentic Hand-Tied Bandhani' },
        { name: 'Occasion', value: 'Haldi Ceremony, Navratri, Pooja' },
        { name: 'Blouse Piece', value: 'Unstitched Bandhani Blouse Piece (0.8m)' },
        { name: 'Care', value: 'Roll Press / Dry Clean' },
      ],
    },
    {
      name: 'Rani Pink & Orange Pachranga Leheriya Saree',
      slug: 'rani-pink-orange-pachranga-leheriya',
      description: 'A celebrated Rajasthani heritage craft. Flowing diagonal chevron waves dyed in joyful shades of rani pink, tangerine orange, saffron, and ruby red. Trimmed with hand-crafted kundan gota patti work.',
      shortDescription: 'Classic Rajasthani multi-color leheriya with authentic kundan gota patti work.',
      categorySlug: 'bandhani-leheriya',
      price: 4599,
      discountPrice: 3499,
      sku: 'RSF-LEHER-001',
      stock: 2, // LOW STOCK FOR ALERT
      lowStockThreshold: 4,
      isFeatured: false,
      isBestseller: false,
      tags: 'leheriya, rani pink, rajasthani, festive, multi color',
      images: [
        'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Airy Chiffon' },
        { name: 'Color', value: 'Pachranga (Rani Pink, Orange, Yellow)' },
        { name: 'Pattern', value: 'Diagonal Ripple Leheriya' },
        { name: 'Occasion', value: 'Teej, Raksha Bandhan, Festive Family Lunch' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Midnight Black Sequin Draped Cocktail Saree',
      slug: 'midnight-black-sequin-draped-cocktail',
      description: 'For the unapologetically glamorous woman. Crafted on premium fluid stretch georgette, this ready-to-drape saree is encrusted with micro matte-black and gunmetal sequins creating a liquid moonlight reflection.',
      shortDescription: 'Fluid georgette drenched in matte black and gunmetal micro-sequins for evening glam.',
      categorySlug: 'party-cocktail-wear',
      price: 8999,
      discountPrice: 6999,
      sku: 'RSF-PARTY-001',
      stock: 9,
      lowStockThreshold: 3,
      isFeatured: true,
      isBestseller: true,
      tags: 'black saree, sequin, cocktail, party wear, modern drape',
      images: [
        'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Fluid Georgette with Stretch Weave' },
        { name: 'Color', value: 'Onyx Midnight Black' },
        { name: 'Embellishment', value: 'Micro Matte-Black & Gunmetal Sequins' },
        { name: 'Occasion', value: 'Cocktail Gala, Sangeet Night, Red Carpet' },
        { name: 'Blouse Piece', value: 'Heavy Sequin Designer Unstitched Fabric (1m)' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Metallic Champagne Pre-Draped Concept Saree',
      slug: 'metallic-champagne-pre-draped-concept',
      description: 'The pinnacle of effortless luxury. A pre-pleated, pre-stitched cocktail saree in metallic shimmer crepe jersey, complete with an attached hand-embroidered waist belt and asymmetric pallu drape.',
      shortDescription: 'Pre-stitched champagne shimmer saree with matching embroidered waist belt.',
      categorySlug: 'party-cocktail-wear',
      price: 10499,
      discountPrice: 8499,
      sku: 'RSF-PARTY-002',
      stock: 7,
      lowStockThreshold: 3,
      isFeatured: false,
      isBestseller: false,
      tags: 'pre-draped, champagne, ready to wear, concept saree, modern',
      images: [
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Metallic Shimmer Crepe' },
        { name: 'Color', value: 'Champagne Gold' },
        { name: 'Style', value: 'Pre-pleated Ready to Wear' },
        { name: 'Occasion', value: 'Reception, Farewell, Fashion Gala' },
        { name: 'Includes', value: 'Pre-stitched Saree + Detachable Embroidered Belt' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Sunset Orange Pure Kanjivaram Brocade Saree',
      slug: 'sunset-orange-pure-kanjivaram-brocade',
      description: 'Capturing the golden hour in silk. Woven in deep fiery saffron-orange with royal purple temple borders, embellished with traditional rudraksha and hamsa zari carvings.',
      shortDescription: 'Fiery saffron-orange Kanjivaram with contrasting royal purple rudraksha border.',
      categorySlug: 'kanjivaram-silk',
      price: 16999,
      discountPrice: 13499,
      sku: 'RSF-KANJI-003',
      stock: 11,
      lowStockThreshold: 4,
      isFeatured: false,
      isBestseller: false,
      tags: 'kanjivaram, saffron, orange, purple border, festive',
      images: [
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Pure Kanchipuram Silk' },
        { name: 'Color', value: 'Sunset Orange & Royal Purple' },
        { name: 'Border', value: 'Korvai Double Warp Temple Border' },
        { name: 'Occasion', value: 'Morning Weddings, Griha Pravesh' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Regal Wine Banarasi Raktambari Silk Saree',
      slug: 'regal-wine-banarasi-raktambari-silk',
      description: 'A dark, jewel-toned marvel. Rich cabernet wine silk katan adorned with dense meenakari silver and gold zari shikargah jungle motifs inspired by Mughal miniature paintings.',
      shortDescription: 'Deep wine Banarasi katan silk featuring intricate meenakari shikargah weaving.',
      categorySlug: 'banarasi-brocade',
      price: 17499,
      discountPrice: 13999,
      sku: 'RSF-BANAR-003',
      stock: 5,
      lowStockThreshold: 3,
      isFeatured: false,
      isBestseller: true,
      tags: 'banarasi, wine, meenakari, shikargah, heirloom',
      images: [
        'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Pure Katan Silk' },
        { name: 'Color', value: 'Deep Cabernet Wine' },
        { name: 'Craft', value: 'Mughal Shikargah with Meenakari highlights' },
        { name: 'Occasion', value: 'Royal Reception, Winter Weddings' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Mint Green Kashmiri Aari Embroidered Organza',
      slug: 'mint-green-kashmiri-aari-embroidered-organza',
      description: 'Crisp mint pastel organza decorated with delicate Kashmiri Aari needlework across all four borders and the pallu. Light as air, yet brimming with bespoke artisan dignity.',
      shortDescription: 'Pastel mint organza with all-over Kashmiri Aari crewel floral embroidery.',
      categorySlug: 'organza-floral',
      price: 5999,
      discountPrice: 4499,
      sku: 'RSF-ORGAN-003',
      stock: 14,
      lowStockThreshold: 4,
      isFeatured: false,
      isBestseller: false,
      tags: 'organza, mint green, kashmiri embroidery, pastel',
      images: [
        'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Premium Silk Organza' },
        { name: 'Color', value: 'Mint Frost Green' },
        { name: 'Embroidery', value: 'Kashmiri Floral Aari Work' },
        { name: 'Occasion', value: 'Garden Party, Engagement, Eid Celebrations' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Mulberry Plum Chanderi Tissue Saree',
      slug: 'mulberry-plum-chanderi-tissue',
      description: 'Loom-woven in shimmering golden-copper tissue silk yarn blended with deep plum warp threads. Creates a mesmerizing dual-tone metallic luster when in motion.',
      shortDescription: 'Dual-tone plum and copper-gold Chanderi tissue with zari butas.',
      categorySlug: 'chanderi-linen',
      price: 5299,
      discountPrice: 3999,
      sku: 'RSF-CHAND-002',
      stock: 10,
      lowStockThreshold: 3,
      isFeatured: false,
      isBestseller: false,
      tags: 'chanderi, tissue silk, plum, metallic, festive',
      images: [
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Tissue Silk Blend' },
        { name: 'Color', value: 'Dual-Tone Mulberry Plum & Gold' },
        { name: 'Occasion', value: 'Diwali, Sangeet, Festive Dinners' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Coral Peach Jaipuri Gota Patti Bandhej Saree',
      slug: 'coral-peach-jaipuri-gota-patti-bandhej',
      description: 'Delicate bandhani tie-dye dots sprinkled over soft coral peach chinon silk fabric, bordered by hand-stitched real Jaipur marodi and gota patti floral vines.',
      shortDescription: 'Chinon silk bandhej in coral peach with authentic Jaipur marodi gota work.',
      categorySlug: 'bandhani-leheriya',
      price: 6199,
      discountPrice: 4799,
      sku: 'RSF-BANDH-002',
      stock: 13,
      lowStockThreshold: 4,
      isFeatured: false,
      isBestseller: true,
      tags: 'bandhani, coral, peach, gota patti, jaipur',
      images: [
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Pure Chinon Silk' },
        { name: 'Color', value: 'Coral Peach' },
        { name: 'Border', value: 'Jaipuri Hand Gota Patti & Zardozi' },
        { name: 'Occasion', value: 'Sangeet, Ring Ceremony, Festive' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Midnight Emerald Ruffle Glamour Saree',
      slug: 'midnight-emerald-ruffle-glamour',
      description: 'A striking fusion of classic drape and contemporary drama. Multi-tiered accordion organza ruffles along the hemline and pallu create fluid movement for fashion-forward soirees.',
      shortDescription: 'Multi-tiered ruffle saree in deep emerald shimmer crepe with crystal belt.',
      categorySlug: 'party-cocktail-wear',
      price: 7899,
      discountPrice: 5999,
      sku: 'RSF-PARTY-003',
      stock: 8,
      lowStockThreshold: 3,
      isFeatured: true,
      isBestseller: false,
      tags: 'ruffle saree, emerald green, fusion, cocktail, party wear',
      images: [
        'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Shimmer Crepe & Organza Ruffles' },
        { name: 'Color', value: 'Deep Emerald Green' },
        { name: 'Style', value: 'Accordion Ruffle Border with Crystal Accents' },
        { name: 'Occasion', value: 'Cocktail Party, Reception, Sangeet' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
    {
      name: 'Natural Beige Tussar Silk Floral Hand-Block Saree',
      slug: 'natural-beige-tussar-silk-floral-hand-block',
      description: 'Pure wild Tussar silk in its earthy golden beige luster. Hand block-printed using vegetable dyes with vintage floral motifs and finished with a rich antique temple border.',
      shortDescription: 'Wild Tussar silk with heritage vegetable dye hand block printing.',
      categorySlug: 'chanderi-linen',
      price: 6899,
      discountPrice: 5299,
      sku: 'RSF-TUSSAR-001',
      stock: 17,
      lowStockThreshold: 5,
      isFeatured: false,
      isBestseller: false,
      tags: 'tussar silk, wild silk, block print, earthy, handloom',
      images: [
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: '100% Wild Tussar (Kosa) Silk' },
        { name: 'Color', value: 'Golden Sand Beige' },
        { name: 'Printing', value: 'Vegetable Dye Hand Block Print' },
        { name: 'Occasion', value: 'Art Exhibitions, Literature Fests, Cultural Events' },
        { name: 'Care', value: 'Dry Clean Recommended' },
      ],
    },
    {
      name: 'Lavender Mist Satin Georgette Saree',
      slug: 'lavender-mist-satin-georgette',
      description: 'Soft pastel dreams. Glossy satin-finish georgette that cascades with flattering drape, highlighted by a subtle tone-on-tone French-knot embroidered border.',
      shortDescription: 'High-gloss pastel lavender satin georgette with delicate French knot embroidery.',
      categorySlug: 'party-cocktail-wear',
      price: 4299,
      discountPrice: 3199,
      sku: 'RSF-SATIN-001',
      stock: 19,
      lowStockThreshold: 5,
      isFeatured: false,
      isBestseller: false,
      tags: 'lavender, pastel, satin georgette, modern, lightweight',
      images: [
        'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Satin Georgette' },
        { name: 'Color', value: 'Lavender Mist' },
        { name: 'Border', value: 'Micro French-Knot & Pearl Lace' },
        { name: 'Occasion', value: 'Day Reception, Birthday Dinner, Farewell' },
        { name: 'Care', value: 'Gentle Wash or Dry Clean' },
      ],
    },
    {
      name: 'Ruby Red Paithani Silk Saree with Peacock Pallu',
      slug: 'ruby-red-paithani-silk-peacock-pallu',
      description: 'The pride of Maharashtra. Pure silk body with gold coin butas and an authentic tapestry weave pallu featuring hand-woven vibrant mor (peacock) motifs and parrot borders.',
      shortDescription: 'Handcrafted pure Paithani silk with signature gold coin butas and mor pallu.',
      categorySlug: 'kanjivaram-silk',
      price: 17999,
      discountPrice: 14499,
      sku: 'RSF-PAITH-001',
      stock: 4, // LOW STOCK FOR ALERT
      lowStockThreshold: 5,
      isFeatured: true,
      isBestseller: true,
      tags: 'paithani, silk, ruby red, peacock pallu, maharashtrian, bridal',
      images: [
        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      ],
      attributes: [
        { name: 'Fabric', value: 'Pure Yeola Paithani Silk' },
        { name: 'Color', value: 'Ruby Red with Royal Blue Pallu' },
        { name: 'Pallu Craft', value: 'Handwoven Tapestry Peacock (Mor) Weave' },
        { name: 'Occasion', value: 'Bridal Wedding, Traditional Pujas' },
        { name: 'Care', value: 'Dry Clean Only' },
      ],
    },
  ];

  const createdProducts = [];
  for (const p of productsData) {
    const categoryId = categoryMap[p.categorySlug];
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        shortDescription: p.shortDescription,
        categoryId: categoryId,
        price: p.price,
        discountPrice: p.discountPrice,
        sku: p.sku,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        status: 'ACTIVE',
        isFeatured: p.isFeatured,
        isBestseller: p.isBestseller,
        tags: p.tags,
        images: {
          create: p.images.map((img, idx) => ({
            url: img,
            altText: `${p.name} - View ${idx + 1}`,
            isPrimary: idx === 0,
            sortOrder: idx,
          })),
        },
        attributes: {
          create: p.attributes.map((attr) => ({
            name: attr.name,
            value: attr.value,
          })),
        },
        inventory: {
          create: {
            currentStock: p.stock,
            reservedStock: 0,
            lowStockAlert: p.stock <= p.lowStockThreshold,
          },
        },
        inventoryLogs: {
          create: {
            type: 'RESTOCK',
            quantityChange: p.stock,
            previousStock: 0,
            newStock: p.stock,
            referenceId: 'INITIAL_SEED',
            notes: 'Initial warehouse batch intake',
          },
        },
      },
    });

    createdProducts.push(product);
  }

  // 6. Verified Customer Reviews
  const reviewsData = [
    {
      productIndex: 0, // Royal Crimson Kanjivaram
      userName: 'Ananya Sengupta',
      rating: 5,
      comment: 'Ordered this for my wedding reception. The silk quality and zari weight are truly top-tier! Looks 10x more expensive in person. Received in 3 days in Kolkata.',
    },
    {
      productIndex: 0,
      userName: 'Dr. Sunita Rao',
      rating: 5,
      comment: 'Authentic Kanchipuram silk certified feel. Pure elegance, authentic zari, and the blouse fabric had ample length.',
    },
    {
      productIndex: 2, // Varanasi Kadwa Banarasi
      userName: 'Meenakshi Iyer',
      rating: 5,
      comment: 'The Kadwa weave is genuine without messy threads on the back. Royal Navy is majestic. Thank you Royal Saree & TechWave!',
    },
    {
      productIndex: 4, // Powder Blue Organza
      userName: 'Rohini Deshmukh',
      rating: 5,
      comment: 'Wore this to a beach day wedding in Goa. So lightweight, didn’t puff up awkwardly, and got endless compliments!',
    },
    {
      productIndex: 8, // Marigold Yellow Bandhani
      userName: 'Kavita Patel',
      rating: 4,
      comment: 'Beautiful bright yellow for my sister’s Haldi. The bandhej tie work is delicate and genuine.',
    },
    {
      productIndex: 10, // Midnight Black Sequin
      userName: 'Aanya Kapoor',
      rating: 5,
      comment: 'Absolute showstopper! The drape fits like a dream, the sequin work doesn’t scratch, and it photographs gorgeously.',
    },
  ];

  for (const rev of reviewsData) {
    const product = createdProducts[rev.productIndex];
    if (product) {
      await prisma.review.create({
        data: {
          productId: product.id,
          userId: customerUser.id,
          userName: rev.userName,
          rating: rev.rating,
          comment: rev.comment,
          isVerifiedPurchase: true,
          status: 'APPROVED',
        },
      });
    }
  }

  // 7. Seed Sample Orders with realistic order lifecycle
  const sampleOrders = [
    {
      orderNumber: 'TW-ORD-10021',
      customerName: 'Priya Sharma',
      customerEmail: 'priya.sharma@example.com',
      customerPhone: '+91 9830123456',
      shippingAddress: 'Flat 4B, Silver Oak Residency, Southern Avenue',
      city: 'Kolkata',
      state: 'West Bengal',
      pinCode: '700029',
      subtotal: 14999,
      discount: 0,
      shippingFee: 0, // free shipping above 1999
      tax: 750,
      total: 15749,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      paymentMethod: 'RAZORPAY',
      razorpayOrderId: 'order_test_k98sd7f98sd',
      razorpayPaymentId: 'pay_test_887df6s8df',
      trackingNumber: 'DEL-EXP-847291',
      carrier: 'Blue Dart Air Express',
      notes: 'Delivered safely with OTP verification.',
      items: [
        {
          product: createdProducts[0],
          quantity: 1,
          unitPrice: 14999,
        },
      ],
    },
    {
      orderNumber: 'TW-ORD-10022',
      customerName: 'Shalini Mukherjee',
      customerEmail: 'shalini.m@gmail.com',
      customerPhone: '+91 9748234190',
      shippingAddress: '12B Ballygunge Circular Road, Near Forum',
      city: 'Kolkata',
      state: 'West Bengal',
      pinCode: '700019',
      subtotal: 10999,
      discount: 500,
      shippingFee: 0,
      tax: 525,
      total: 11024,
      status: 'SHIPPED',
      paymentStatus: 'PAID',
      paymentMethod: 'RAZORPAY',
      razorpayOrderId: 'order_test_349sd7f98aa',
      razorpayPaymentId: 'pay_test_112df6s8bb',
      trackingNumber: 'DTDC-AIR-992144',
      carrier: 'DTDC Premium Express',
      notes: 'In transit to local hub.',
      items: [
        {
          product: createdProducts[2],
          quantity: 1,
          unitPrice: 10999,
        },
      ],
    },
    {
      orderNumber: 'TW-ORD-10023',
      customerName: 'Aditi Verma',
      customerEmail: 'aditi.verma@outlook.com',
      customerPhone: '+91 9811443322',
      shippingAddress: 'Villa 45, DLF Phase 5, Golf Course Road',
      city: 'Gurugram',
      state: 'Haryana',
      pinCode: '122002',
      subtotal: 11998, // 2 items
      discount: 0,
      shippingFee: 0,
      tax: 600,
      total: 12598,
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      paymentMethod: 'RAZORPAY',
      razorpayOrderId: 'order_test_776sd7f98cc',
      razorpayPaymentId: 'pay_test_334df6s8dd',
      trackingNumber: null,
      carrier: 'Delhivery Surface',
      notes: 'Item being carefully checked for zari quality & packed.',
      items: [
        {
          product: createdProducts[4], // Powder blue organza (4999)
          quantity: 1,
          unitPrice: 4999,
        },
        {
          product: createdProducts[10], // Black sequin cocktail (6999)
          quantity: 1,
          unitPrice: 6999,
        },
      ],
    },
    {
      orderNumber: 'TW-ORD-10024',
      customerName: 'Ritu Chawla',
      customerEmail: 'ritu.c@yahoo.com',
      customerPhone: '+91 9920194821',
      shippingAddress: 'Tower 3, Penthouse 18, Powai Lake Hiranandani',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400076',
      subtotal: 4199,
      discount: 0,
      shippingFee: 0,
      tax: 210,
      total: 4409,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      paymentMethod: 'RAZORPAY',
      razorpayOrderId: 'order_test_998sd7f98ee',
      razorpayPaymentId: 'pay_test_556df6s8ff',
      trackingNumber: null,
      carrier: null,
      notes: 'Order received, dispatched to sorting facility.',
      items: [
        {
          product: createdProducts[8], // Yellow Bandhani (4199)
          quantity: 1,
          unitPrice: 4199,
        },
      ],
    },
  ];

  for (const o of sampleOrders) {
    const createdOrder = await prisma.order.create({
      data: {
        orderNumber: o.orderNumber,
        userId: o.customerEmail === 'priya.sharma@example.com' ? customerUser.id : null,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        shippingAddress: o.shippingAddress,
        city: o.city,
        state: o.state,
        pinCode: o.pinCode,
        subtotal: o.subtotal,
        discount: o.discount,
        shippingFee: o.shippingFee,
        tax: o.tax,
        total: o.total,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        razorpayOrderId: o.razorpayOrderId,
        razorpayPaymentId: o.razorpayPaymentId,
        trackingNumber: o.trackingNumber,
        carrier: o.carrier,
        notes: o.notes,
        items: {
          create: o.items.map((it) => ({
            productId: it.product.id,
            productName: it.product.name,
            productSku: it.product.sku,
            productImage: it.product.images?.[0] || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=400',
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            total: it.unitPrice * it.quantity,
            attributesJson: JSON.stringify({ note: 'Handpicked quality inspected' }),
          })),
        },
        payments: {
          create: {
            paymentGateway: 'RAZORPAY',
            gatewayOrderId: o.razorpayOrderId,
            gatewayPaymentId: o.razorpayPaymentId,
            gatewaySignature: 'sig_verified_mock_checksum',
            amount: o.total,
            currency: 'INR',
            status: 'SUCCESS',
            rawResponse: JSON.stringify({ method: 'UPI / NetBanking', bank: 'HDFC' }),
          },
        },
      },
    });

    // Record inventory deduction
    for (const it of o.items) {
      await prisma.inventoryTransaction.create({
        data: {
          productId: it.product.id,
          type: 'ORDER_DEDUCT',
          quantityChange: -it.quantity,
          previousStock: it.product.stock,
          newStock: Math.max(0, it.product.stock - it.quantity),
          referenceId: createdOrder.orderNumber,
          notes: `Deducted for verified order ${createdOrder.orderNumber}`,
        },
      });
    }
  }

  // 8. Sample Customer Inquiries
  const sampleInquiries = [
    {
      name: 'Nandini Das',
      email: 'nandini.das@gmail.com',
      phone: '+91 9831002244',
      message: 'Hello, do you provide customized stitched blouse with matching embroidery for the Royal Crimson Kanjivaram?',
      inquiryType: 'PRODUCT',
      productId: createdProducts[0].id,
      status: 'IN_PROGRESS',
      adminNotes: 'Contacted customer on WhatsApp. Blouse measurement chart sent.',
    },
    {
      name: 'Suresh Menon',
      email: 'suresh.menon@kerala.org',
      phone: '+91 9447123980',
      message: 'Can you deliver the Kadwa Banarasi Saree to Kochi by next Friday for an engagement ceremony?',
      inquiryType: 'PRODUCT',
      productId: createdProducts[2].id,
      status: 'NEW',
      adminNotes: null,
    },
    {
      name: 'Pooja Agarwal',
      email: 'pooja.agarwal@gmail.com',
      phone: '+91 9820011223',
      message: 'Looking for bulk purchase of 12 Bandhani sarees for bridesmaids gifts. Any special discount?',
      inquiryType: 'WHOLESALE',
      productId: createdProducts[8].id,
      status: 'RESOLVED',
      adminNotes: 'Offered 15% wholesale discount with free gift packaging. Order finalized.',
    },
  ];

  for (const inq of sampleInquiries) {
    await prisma.inquiry.create({ data: inq });
  }

  console.log('Seeding completed successfully!');
  console.log('Admin Account: admin@royal.techwavesolutions.dev (password: admin123)');
  console.log('Customer Account: priya.sharma@example.com (password: customer123)');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
