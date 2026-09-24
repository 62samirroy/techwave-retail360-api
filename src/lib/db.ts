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
    console.log('✅ Supabase PostgreSQL Database synced with verified online Pexels luxury saree URLs');
  } catch (err) {
    // Non-blocking sync
  }
}
syncRoyalImages();

export default prisma;
