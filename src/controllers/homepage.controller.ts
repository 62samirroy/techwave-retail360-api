import { Request, Response } from 'express';
import prisma from '../lib/db';

export const DEFAULT_HOMEPAGE_CONFIG = {
  heroSlides: [
    {
      id: 1,
      title: 'The Grand Bridal & Heritage Showcase',
      subtitle: 'The eternal charm of authentic handloom silk sarees curated by Retail 360°, woven with pure gold zari and generational artistry.',
      image: '/hero-banner-1.jpg',
      ctaText: 'SHOP NOW',
      ctaLink: '/categories/kanjivaram-silk',
    },
    {
      id: 2,
      title: 'Kadwa Brocades & Varanasi Masterweaves',
      subtitle: 'Hand-interlocked floral jaal and antique meenakari motifs handcrafted on generational pit looms.',
      image: '/hero-banner-2.jpg',
      ctaText: 'SHOP NOW',
      ctaLink: '/categories/banarasi-brocade',
    },
    {
      id: 3,
      title: 'Ethereal Pastels & Organza Tissue Silks',
      subtitle: 'Airy silhouettes adorned with delicate gota patti borders and botanical foil zari drapes.',
      image: '/hero-banner-3.jpg',
      ctaText: 'SHOP NOW',
      ctaLink: '/categories/organza-floral',
    },
  ],
  newArrivals: {
    sectionTitle: "Today's New Arrivals",
    links: [
      { label: 'View All New Arrivals', href: '/shop' },
      { label: 'Pure Kanchipuram Silks', href: '/categories/kanjivaram-silk' },
      { label: 'Soft Silk Sarees', href: '/shop?search=soft+silk' },
    ],
    curatedCard: {
      title: 'Curated Combos',
      subtitle: 'Heirloom handloom sarees matched with contrast designer blouse pieces.',
      image: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=800',
      ctaText: 'SHOP NOW',
      ctaLink: '/shop',
    },
  },
  kanchipuram: {
    badge: '✦ SACRED WEAVES OF SOUTH INDIA ✦',
    title: 'Pure Kanchipuram Silks',
    subtitle: 'Handpicked masterweaves from the historic temple town of Kanchipuram',
    lookbookCard: {
      title: 'Bridal Silks',
      subtitle: 'Authentic 3-ply mulberry silks with certified tested silver & gold zari.',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      link: '/categories/kanjivaram-silk',
    },
  },
  bridalFestive: {
    badge: 'CELEBRITY & ROYAL LOOKBOOK',
    title: 'Bridal & Festive Edit',
    viewAllLink: '/shop?featured=true',
    cards: [
      {
        id: 'rsf-kanji-001',
        title: 'Royal Saree Black Bridal Kanchipuram Silk Saree',
        price: 32500,
        originalPrice: 38000,
        image: 'https://images.pexels.com/photos/1488312/pexels-photo-1488312.jpeg?auto=compress&cs=tinysrgb&w=800',
        link: '/shop',
      },
      {
        id: 'rsf-banar-001',
        title: 'Sindhoor Red Gold Zari Heavy Bridal Silk Saree',
        price: 36000,
        originalPrice: 42000,
        image: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=800',
        link: '/shop',
      },
      {
        id: 'rsf-kanji-002',
        title: 'Lavanya Lilac Pastel Brocade Kanchipuram Saree',
        price: 28500,
        originalPrice: 33000,
        image: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=800',
        link: '/shop',
      },
      {
        id: 'rsf-organza-001',
        title: 'Suvarna Beige Tissue Handloom Silk Saree',
        price: 29900,
        originalPrice: 35000,
        image: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=800',
        link: '/shop',
      },
    ],
  },
  videoBanner: {
    badge: 'THE ROYAL WEAVE IN MOTION',
    title: 'Generations of Handloom Artistry Captured on Film',
    description:
      'Witness authentic master artisans at the pit loom weaving pure mulberry silk and certified 24K electroplated gold zari. Each heritage saree represents over 200 hours of unhurried generational rhythm.',
    videoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/b/bd/Weaving_Tant_Saree_by_Handloom_-_2_Natun_Phulia_-_Nadia_2016-11-12_1804.webm',
    poster: '/hero-banner-2.jpg',
    cta1Text: 'EXPLORE BRIDAL EDIT',
    cta1Link: '/shop?featured=true',
    cta2Text: 'BOOK LIVE VIDEO DRAPE',
  },
  weddingStories: {
    badge: 'CELEBRATE TRADITIONS',
    title: 'Wedding & Festive Stories',
    subtitle: 'Curating unforgettable memories for brides and families',
    stories: [
      {
        title: 'Muhurtham',
        subtitle: 'Traditional Sacred Silks',
        image: 'https://images.pexels.com/photos/1488312/pexels-photo-1488312.jpeg?auto=compress&cs=tinysrgb&w=600',
        link: '/shop',
      },
      {
        title: 'Haldi & Sangeet',
        subtitle: 'Sunlit Auspicious Drapes',
        image: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=600',
        link: '/shop',
      },
      {
        title: 'The Bridal Trousseau',
        subtitle: 'Generational Heirlooms',
        image: 'https://images.pexels.com/photos/3321793/pexels-photo-3321793.jpeg?auto=compress&cs=tinysrgb&w=600',
        link: '/shop',
      },
      {
        title: 'Grand Reception',
        subtitle: 'Opulent Kadwa Brocades',
        image: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=600',
        link: '/shop',
      },
      {
        title: 'Pujas & Celebrations',
        subtitle: 'Festive Auspicious Drapes',
        image: 'https://images.pexels.com/photos/1589216/pexels-photo-1589216.jpeg?auto=compress&cs=tinysrgb&w=600',
        link: '/shop',
      },
    ],
  },
  loomStory: {
    badge: 'AUTHENTIC CRAFTSMANSHIP',
    title: 'Silk Swatches | The Weaving Loom Story',
    subtitle: 'Zoom into the intricate craft of our master weavers',
    swatches: [
      {
        title: 'Pure Tested Zari',
        desc: 'Certified gold & silver plate',
        image: 'https://images.pexels.com/photos/1488312/pexels-photo-1488312.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        title: 'Korvai Weaving',
        desc: 'Hand-interlocked three-shuttle',
        image: 'https://images.pexels.com/photos/1589216/pexels-photo-1589216.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        title: 'Kadwa Technique',
        desc: 'No loose floating threads',
        image: 'https://images.pexels.com/photos/3321793/pexels-photo-3321793.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        title: 'Meenakari Inlay',
        desc: 'Colorful enamel silk threads',
        image: 'https://images.pexels.com/photos/1162983/pexels-photo-1162983.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        title: 'Mulberry 3-Ply',
        desc: 'Superior tensile strength & sheen',
        image: 'https://images.pexels.com/photos/1730877/pexels-photo-1730877.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
      {
        title: 'Temple Border',
        desc: 'Sacred gopuram architecture',
        image: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=400',
      },
    ],
  },
  readyToShip: {
    badge: 'Dispatches in 24 Hours',
    title: 'Ready to Ship Sarees',
    viewAllLink: '/shop?inStock=true',
  },
  stores: {
    badge: '✦ OUR RETAIL DESTINATIONS ✦',
    title: 'Visit Our Stores',
    subtitle: 'Experience the touch of authentic handlooms across our flagship showrooms',
    stores: [
      {
        id: 'chennai',
        name: 'T. Nagar, Chennai',
        rating: '4.9',
        reviews: '180+ Reviews',
        address: 'Pondy Bazaar, T. Nagar, Chennai, Tamil Nadu 600017',
        phone: '+91 44 2434 5678',
        hours: '10:00 AM - 9:00 PM',
        image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&q=80&w=800',
        mapQuery: 'T. Nagar Chennai Saree Boutique',
      },
      {
        id: 'bengaluru',
        name: 'Jayanagar, Bengaluru',
        rating: '4.9',
        reviews: '240+ Reviews',
        address: '11th Main, 4th Block, Jayanagar, Bengaluru 560011',
        phone: '+91 80 2656 7890',
        hours: '10:00 AM - 9:30 PM',
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800',
        mapQuery: 'Jayanagar Bengaluru Saree Boutique',
      },
      {
        id: 'hyderabad',
        name: 'Banjara Hills, Hyderabad',
        rating: '4.8',
        reviews: '195+ Reviews',
        address: 'Road No. 10, Banjara Hills, Hyderabad, Telangana 500034',
        phone: '+91 40 2335 1234',
        hours: '10:30 AM - 9:00 PM',
        image: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&q=80&w=800',
        mapQuery: 'Banjara Hills Hyderabad Saree Boutique',
      },
      {
        id: 'kolkata',
        name: 'Salt Lake, Kolkata',
        rating: '4.9',
        reviews: '210+ Reviews',
        address: 'TechWave Tower, Sector V, Salt Lake, Kolkata 700091',
        phone: '+91 9641145871',
        hours: '10:00 AM - 9:00 PM',
        image: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&q=80&w=800',
        mapQuery: 'Salt Lake Sector V Kolkata Saree Boutique',
      },
      {
        id: 'delhi',
        name: 'Connaught Place, New Delhi',
        rating: '4.8',
        reviews: '170+ Reviews',
        address: 'Block E, Inner Circle, Connaught Place, New Delhi 110001',
        phone: '+91 11 2341 5678',
        hours: '10:30 AM - 8:30 PM',
        image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&q=80&w=800',
        mapQuery: 'Connaught Place New Delhi Saree Boutique',
      },
      {
        id: 'mumbai',
        name: 'Kala Ghoda, Mumbai',
        rating: '4.9',
        reviews: '220+ Reviews',
        address: 'Heritage Mile, Kala Ghoda, Fort, Mumbai 400001',
        phone: '+91 22 2284 9012',
        hours: '10:00 AM - 9:00 PM',
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800',
        mapQuery: 'Kala Ghoda Fort Mumbai Saree Boutique',
      },
    ],
  },
};

const HOMEPAGE_SETTING_KEY = 'homepage_config';

export class HomepageController {
  static async getConfig(req: Request, res: Response) {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: HOMEPAGE_SETTING_KEY },
      });

      if (!setting || !setting.value) {
        return res.json({
          success: true,
          data: DEFAULT_HOMEPAGE_CONFIG,
          isDefault: true,
        });
      }

      try {
        const parsed = JSON.parse(setting.value);
        // Deep merge with defaults to ensure all sections and keys exist
        const merged = {
          heroSlides: parsed.heroSlides?.length ? parsed.heroSlides : DEFAULT_HOMEPAGE_CONFIG.heroSlides,
          newArrivals: {
            ...DEFAULT_HOMEPAGE_CONFIG.newArrivals,
            ...(parsed.newArrivals || {}),
            curatedCard: {
              ...DEFAULT_HOMEPAGE_CONFIG.newArrivals.curatedCard,
              ...(parsed.newArrivals?.curatedCard || {}),
            },
          },
          kanchipuram: {
            ...DEFAULT_HOMEPAGE_CONFIG.kanchipuram,
            ...(parsed.kanchipuram || {}),
            lookbookCard: {
              ...DEFAULT_HOMEPAGE_CONFIG.kanchipuram.lookbookCard,
              ...(parsed.kanchipuram?.lookbookCard || {}),
            },
          },
          bridalFestive: {
            ...DEFAULT_HOMEPAGE_CONFIG.bridalFestive,
            ...(parsed.bridalFestive || {}),
            cards: parsed.bridalFestive?.cards?.length
              ? parsed.bridalFestive.cards
              : DEFAULT_HOMEPAGE_CONFIG.bridalFestive.cards,
          },
          videoBanner: {
            ...DEFAULT_HOMEPAGE_CONFIG.videoBanner,
            ...(parsed.videoBanner || {}),
          },
          weddingStories: {
            ...DEFAULT_HOMEPAGE_CONFIG.weddingStories,
            ...(parsed.weddingStories || {}),
            stories: parsed.weddingStories?.stories?.length
              ? parsed.weddingStories.stories
              : DEFAULT_HOMEPAGE_CONFIG.weddingStories.stories,
          },
          loomStory: {
            ...DEFAULT_HOMEPAGE_CONFIG.loomStory,
            ...(parsed.loomStory || {}),
            swatches: parsed.loomStory?.swatches?.length
              ? parsed.loomStory.swatches
              : DEFAULT_HOMEPAGE_CONFIG.loomStory.swatches,
          },
          readyToShip: {
            ...DEFAULT_HOMEPAGE_CONFIG.readyToShip,
            ...(parsed.readyToShip || {}),
          },
          stores: {
            ...DEFAULT_HOMEPAGE_CONFIG.stores,
            ...(parsed.stores || {}),
            stores: parsed.stores?.stores?.length
              ? parsed.stores.stores
              : DEFAULT_HOMEPAGE_CONFIG.stores.stores,
          },
        };

        return res.json({
          success: true,
          data: merged,
          updatedAt: setting.updatedAt,
          isDefault: false,
        });
      } catch (e) {
        return res.json({
          success: true,
          data: DEFAULT_HOMEPAGE_CONFIG,
          isDefault: true,
        });
      }
    } catch (error: any) {
      console.error('[HomepageController.getConfig error]:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateConfig(req: Request, res: Response) {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid homepage configuration data' });
      }

      const jsonString = JSON.stringify(payload);

      await prisma.setting.upsert({
        where: { key: HOMEPAGE_SETTING_KEY },
        create: {
          key: HOMEPAGE_SETTING_KEY,
          value: jsonString,
          description: 'Customized homepage sections content and layout configuration',
        },
        update: {
          value: jsonString,
          description: 'Customized homepage sections content and layout configuration',
        },
      });

      return res.json({
        success: true,
        message: 'Homepage content updated and published successfully',
        data: payload,
      });
    } catch (error: any) {
      console.error('[HomepageController.updateConfig error]:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async resetDefaults(req: Request, res: Response) {
    try {
      await prisma.setting.deleteMany({
        where: { key: HOMEPAGE_SETTING_KEY },
      });

      return res.json({
        success: true,
        message: 'Homepage restored to default configuration successfully',
        data: DEFAULT_HOMEPAGE_CONFIG,
      });
    } catch (error: any) {
      console.error('[HomepageController.resetDefaults error]:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
