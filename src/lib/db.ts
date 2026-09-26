import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function syncRoyalImages() {
  try {
    const mappings = [
      {
        slug: 'royal-crimson-kanjivaram-silk',
        img: 'https://images.pexels.com/photos/1488312/pexels-photo-1488312.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'emerald-peacock-kanjivaram-weave',
        img: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'varanasi-royal-navy-kadwa-banarasi',
        img: 'https://images.pexels.com/photos/3321793/pexels-photo-3321793.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'vintage-gulab-pink-banarasi-tanchoi',
        img: 'https://images.pexels.com/photos/2220316/pexels-photo-2220316.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'ruby-red-paithani-silk-peacock-pallu',
        img: 'https://images.pexels.com/photos/1589216/pexels-photo-1589216.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'midnight-emerald-ruffle-glamour',
        img: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'natural-beige-tussar-silk-floral-hand-block',
        img: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'lavender-mist-satin-georgette',
        img: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'powder-blue-scallop-hand-painted-organza',
        img: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'marigold-yellow-traditional-bandhani-georgette',
        img: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'midnight-black-sequin-draped-cocktail',
        img: 'https://images.pexels.com/photos/247287/pexels-photo-247287.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
    ];

    for (const m of mappings) {
      const prod = await prisma.product.findFirst({ where: { slug: m.slug }, select: { id: true } });
      if (prod) {
        await prisma.productImage.updateMany({
          where: { productId: prod.id },
          data: { url: m.img },
        });
      }
    }

    const catMappings = [
      {
        slug: 'kanjivaram-silk',
        img: 'https://images.pexels.com/photos/1488312/pexels-photo-1488312.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'banarasi-brocade',
        img: 'https://images.pexels.com/photos/3321793/pexels-photo-3321793.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'organza-floral',
        img: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'chanderi-linen',
        img: 'https://images.pexels.com/photos/2220316/pexels-photo-2220316.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'bandhani-leheriya',
        img: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
      {
        slug: 'party-cocktail-wear',
        img: 'https://images.pexels.com/photos/247287/pexels-photo-247287.jpeg?auto=compress&cs=tinysrgb&w=800',
      },
    ];

    for (const c of catMappings) {
      await prisma.category.updateMany({
        where: { slug: c.slug },
        data: { image: c.img },
      });
    }

    // 3. Ensure all regional specialty categories exist
    const specialtyCategories = [
      {
        name: 'Gadwal Pattu',
        slug: 'gadwal-pattu',
        description: 'Sacred South Indian handlooms with contrasting kuttu temple borders and pure zari.',
        image: 'https://images.pexels.com/photos/1488312/pexels-photo-1488312.jpeg?auto=compress&cs=tinysrgb&w=800',
        sortOrder: 7,
      },
      {
        name: 'Patola Sarees',
        slug: 'patola-sarees',
        description: 'Masterpiece double and single ikat weaves from Patan and Rajkot with geometric precision.',
        image: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=800',
        sortOrder: 8,
      },
      {
        name: 'Baluchari Silks',
        slug: 'baluchari-silks',
        description: 'Bishnupur heritage silk sarees depicting classical epics, Ramayana, and royal courts.',
        image: 'https://images.pexels.com/photos/3321793/pexels-photo-3321793.jpeg?auto=compress&cs=tinysrgb&w=800',
        sortOrder: 9,
      },
      {
        name: 'Mysore Crepe Silk',
        slug: 'mysore-crepe',
        description: 'Lightweight pure silk crepe drapes with lustrous 100% pure gold zari borders from Karnataka.',
        image: 'https://images.pexels.com/photos/247287/pexels-photo-247287.jpeg?auto=compress&cs=tinysrgb&w=800',
        sortOrder: 10,
      },
      {
        name: 'Soft Silk Sarees',
        slug: 'soft-silk-sarees',
        description: 'Lightweight, easy-to-drape pure mulberry soft silks woven for modern elegance.',
        image: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=800',
        sortOrder: 11,
      },
    ];

    for (const sc of specialtyCategories) {
      const existingCat = await prisma.category.findUnique({ where: { slug: sc.slug } });
      if (!existingCat) {
        await prisma.category.create({
          data: {
            name: sc.name,
            slug: sc.slug,
            description: sc.description,
            image: sc.image,
            sortOrder: sc.sortOrder,
            status: 'ACTIVE',
          },
        });
      }
    }

    // 4. Ensure products exist for all categories and search specialties
    const newProducts = [
      {
        name: 'Maharani Gold Zari Gadwal Pattu Saree',
        slug: 'maharani-gold-zari-gadwal-pattu',
        description: 'Authentic Gadwal handloom featuring a pure cotton body with rich contrast silk kuttu borders in royal crimson and pure gold zari temple motifs.',
        shortDescription: 'Sacred Gadwal Pattu with contrast silk kuttu border and pure gold zari.',
        categorySlug: 'gadwal-pattu',
        price: 13999,
        discountPrice: 10999,
        sku: 'RSF-GADWAL-001',
        stock: 12,
        lowStockThreshold: 3,
        isFeatured: true,
        isBestseller: true,
        tags: 'gadwal, pattu, gadwal pattu, silk, temple border, south silk, wedding',
        image: 'https://images.pexels.com/photos/1488312/pexels-photo-1488312.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Fabric', value: 'Gadwal Pure Silk & Cotton' },
          { name: 'Border', value: 'Kuttu Silk Temple Border' },
          { name: 'Occasion', value: 'Festive, Pujas, Traditional Weddings' },
        ],
      },
      {
        name: 'Teal & Contrast Magenta Gadwal Silk Saree',
        slug: 'teal-contrast-magenta-gadwal-silk',
        description: 'A luminous peacock teal Gadwal silk saree with intricate golden zari butis and a grand magenta pallu.',
        shortDescription: 'Peacock teal Gadwal silk with magenta contrast gold zari pallu.',
        categorySlug: 'gadwal-pattu',
        price: 14999,
        discountPrice: 11999,
        sku: 'RSF-GADWAL-002',
        stock: 9,
        lowStockThreshold: 3,
        isFeatured: false,
        isBestseller: true,
        tags: 'gadwal, pattu, silk, teal, magenta, contrast pallu',
        image: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Fabric', value: '100% Pure Mulberry Silk' },
          { name: 'Occasion', value: 'Bridal Reception, Festive Family Events' },
        ],
      },
      {
        name: 'Heritage Double Ikat Rajkot Patola Silk Saree',
        slug: 'heritage-double-ikat-rajkot-patola',
        description: 'Celebrated Gujarat heritage double-ikat weave with elephant (kunjar) and floral geometric motifs, hand-dyed with natural pigments.',
        shortDescription: 'Exquisite double ikat Patola silk in royal maroon with geometric kunjar motifs.',
        categorySlug: 'patola-sarees',
        price: 19999,
        discountPrice: 16499,
        sku: 'RSF-PATOLA-001',
        stock: 7,
        lowStockThreshold: 2,
        isFeatured: true,
        isBestseller: true,
        tags: 'patola, patola sarees, ikat, double ikat, gujarat, rajkot, royal',
        image: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Weave', value: 'Authentic Double Ikat' },
          { name: 'Occasion', value: 'Royal Wedding, Heirloom Collection' },
        ],
      },
      {
        name: 'Patan Crimson Silk Patola Saree with Parrot Motifs',
        slug: 'patan-crimson-silk-patola-saree',
        description: 'Authentic Patan Patola saree woven with high precision, displaying vibrant parrot and lotus motifs bordered with pure zari selvedge.',
        shortDescription: 'Handcrafted Patan Patola silk with signature popat (parrot) and lotus motifs.',
        categorySlug: 'patola-sarees',
        price: 24999,
        discountPrice: 19999,
        sku: 'RSF-PATOLA-002',
        stock: 5,
        lowStockThreshold: 2,
        isFeatured: true,
        isBestseller: false,
        tags: 'patola, patola sarees, patan patola, crimson, bridal, heirloom',
        image: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Origin', value: 'Patan, Gujarat' },
          { name: 'Occasion', value: 'Grand Ceremonies' },
        ],
      },
      {
        name: 'Bishnupur Swarnachari & Baluchari Silk Saree',
        slug: 'bishnupur-swarnachari-baluchari-silk',
        description: 'Handwoven in West Bengal with pure gold zari threads depicting scenes from ancient epics and royal processions across the magnificent pallu.',
        shortDescription: 'Bishnupur Swarnachari silk with epic mythological storytelling woven in gold zari.',
        categorySlug: 'baluchari-silks',
        price: 16999,
        discountPrice: 13999,
        sku: 'RSF-BALU-001',
        stock: 8,
        lowStockThreshold: 3,
        isFeatured: true,
        isBestseller: true,
        tags: 'baluchari, baluchari silks, swarnachari, bishnupur, mythology, handloom',
        image: 'https://images.pexels.com/photos/3321793/pexels-photo-3321793.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Craft', value: 'Swarnachari Gold Brocade' },
          { name: 'Occasion', value: 'Durga Puja, Classical Soirees, Weddings' },
        ],
      },
      {
        name: 'Royal Purple Mythological Baluchari Handloom Saree',
        slug: 'royal-purple-mythological-baluchari',
        description: 'Deep royal purple pure silk Baluchari with exquisite minakari highlights depicting historical court musicians and ornate temple chariots.',
        shortDescription: 'Royal purple Baluchari handloom with minakari narrative pallu.',
        categorySlug: 'baluchari-silks',
        price: 15499,
        discountPrice: 12499,
        sku: 'RSF-BALU-002',
        stock: 6,
        lowStockThreshold: 2,
        isFeatured: false,
        isBestseller: true,
        tags: 'baluchari, baluchari silks, purple, handloom, silk mark',
        image: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Fabric', value: '100% Pure Mulberry Silk' },
          { name: 'Occasion', value: 'Cultural Evenings, Wedding Reception' },
        ],
      },
      {
        name: 'Pure Mysore Silk Crepe Gold Zari Saree',
        slug: 'pure-mysore-silk-crepe-gold-zari',
        description: 'Government Silk Board certified authentic Karnataka Mysore crepe silk saree with 100% pure gold zari borders and a lightweight fluid drape.',
        shortDescription: 'Pure Mysore silk crepe with authentic gold zari border and rich luster.',
        categorySlug: 'mysore-crepe',
        price: 11999,
        discountPrice: 9499,
        sku: 'RSF-CREPE-001',
        stock: 15,
        lowStockThreshold: 4,
        isFeatured: true,
        isBestseller: true,
        tags: 'crepe, mysore crepe, mysore silk, gold zari, lightweight, royal karnataka',
        image: 'https://images.pexels.com/photos/247287/pexels-photo-247287.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Fabric', value: '100% Pure Crepe Silk (KSIC Quality)' },
          { name: 'Occasion', value: 'Conferences, Daytime Celebrations, Weddings' },
        ],
      },
      {
        name: 'Royal Sapphire Blue Mysore Crepe Silk Saree',
        slug: 'royal-sapphire-blue-mysore-crepe',
        description: 'Vibrant sapphire blue Mysore crepe silk saree accented with a fine antique gold coin border and embossed pallu lines.',
        shortDescription: 'Sapphire blue pure crepe silk with antique gold border.',
        categorySlug: 'mysore-crepe',
        price: 9999,
        discountPrice: 7999,
        sku: 'RSF-CREPE-002',
        stock: 11,
        lowStockThreshold: 3,
        isFeatured: false,
        isBestseller: true,
        tags: 'crepe, mysore crepe, sapphire blue, lightweight, festive',
        image: 'https://images.pexels.com/photos/2220316/pexels-photo-2220316.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Fabric', value: 'Pure Crepe Silk' },
          { name: 'Occasion', value: 'Festive Dinners, Formal Evenings' },
        ],
      },
      {
        name: 'Pastel Lavender Pure Soft Silk Handloom Saree',
        slug: 'pastel-lavender-pure-soft-silk',
        description: 'Ultra-gentle drape soft silk saree woven with fine silver zari florals across the pastel lavender body. Feather-light for easy all-day wear.',
        shortDescription: 'Featherweight pastel lavender soft silk with delicate silver zari florals.',
        categorySlug: 'soft-silk-sarees',
        price: 8999,
        discountPrice: 6999,
        sku: 'RSF-SOFTSILK-001',
        stock: 14,
        lowStockThreshold: 4,
        isFeatured: true,
        isBestseller: true,
        tags: 'soft silk, soft silk sarees, pastel, lavender, lightweight, modern festive',
        image: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Fabric', value: 'Mulberry Soft Silk' },
          { name: 'Occasion', value: 'Engagement, Day Weddings, Receptions' },
        ],
      },
      {
        name: 'Rose Gold Lightweight Pure Soft Silk Saree',
        slug: 'rose-gold-lightweight-soft-silk',
        description: 'Contemporary rose gold soft silk drape shimmering with soft metallic sheen, paired with a matching designer unstitched blouse.',
        shortDescription: 'Shimmering rose gold pure soft silk with fine self zari border.',
        categorySlug: 'soft-silk-sarees',
        price: 9499,
        discountPrice: 7499,
        sku: 'RSF-SOFTSILK-002',
        stock: 12,
        lowStockThreshold: 3,
        isFeatured: false,
        isBestseller: true,
        tags: 'soft silk, soft silk sarees, rose gold, lightweight, wedding guest',
        image: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=800',
        attributes: [
          { name: 'Fabric', value: 'Pure Soft Silk' },
          { name: 'Occasion', value: 'Cocktail, Festive Gatherings' },
        ],
      },
    ];

    for (const np of newProducts) {
      const existingProd = await prisma.product.findUnique({ where: { slug: np.slug } });
      if (!existingProd) {
        const cat = await prisma.category.findUnique({ where: { slug: np.categorySlug } });
        if (cat) {
          await prisma.product.create({
            data: {
              name: np.name,
              slug: np.slug,
              description: np.description,
              shortDescription: np.shortDescription,
              categoryId: cat.id,
              price: np.price,
              discountPrice: np.discountPrice,
              sku: np.sku,
              stock: np.stock,
              lowStockThreshold: np.lowStockThreshold,
              status: 'ACTIVE',
              isFeatured: np.isFeatured,
              isBestseller: np.isBestseller,
              tags: np.tags,
              images: {
                create: [
                  {
                    url: np.image,
                    altText: `${np.name} Primary View`,
                    isPrimary: true,
                    sortOrder: 0,
                  },
                ],
              },
              attributes: {
                create: np.attributes.map((a) => ({ name: a.name, value: a.value })),
              },
              inventory: {
                create: {
                  currentStock: np.stock,
                  reservedStock: 0,
                  lowStockAlert: false,
                },
              },
              inventoryLogs: {
                create: {
                  type: 'RESTOCK',
                  quantityChange: np.stock,
                  previousStock: 0,
                  newStock: np.stock,
                  referenceId: 'INITIAL_SEED',
                  notes: 'Auto-seeded specialty inventory',
                },
              },
            },
          });
        }
      }
    }

    console.log('✅ Supabase PostgreSQL Database synced with verified online Pexels luxury saree URLs and complete specialty collections');
  } catch (err) {
    console.error('Non-blocking sync error:', err);
  }
}
syncRoyalImages();

export default prisma;
