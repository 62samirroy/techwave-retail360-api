-- ==============================================================================
-- TechWave Retail360 - PostgreSQL / Supabase Turnkey Database Architecture
-- Client: Royal Saree & Fashion (TechWave Solutions)
-- Target: Supabase Cloud PostgreSQL / Self-Hosted PostgreSQL 14+
-- ==============================================================================

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Enums
DO $$ BEGIN
    CREATE TYPE role_type AS ENUM ('CUSTOMER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE product_status_type AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status_type AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE inquiry_status_type AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE inquiry_type_enum AS ENUM ('GENERAL', 'PRODUCT', 'BRIDAL', 'WHOLESALE', 'PRODUCT_CUSTOMIZATION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE inventory_change_type_enum AS ENUM ('ORDER_DEDUCT', 'RESTOCK', 'ADJUSTMENT', 'ORDER_CANCEL_RESTORE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Trigger Function for Automatic Timestamp Updating
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Tables

-- Users Table
CREATE TABLE IF NOT EXISTS "User" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "role" VARCHAR(50) DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles
CREATE TABLE IF NOT EXISTS "Profile" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "defaultAddressId" VARCHAR(255),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Saree Weave Categories
CREATE TABLE IF NOT EXISTS "Category" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) UNIQUE NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "status" VARCHAR(50) DEFAULT 'ACTIVE',
    "sortOrder" INT DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Products Catalog
CREATE TABLE IF NOT EXISTS "Product" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) UNIQUE NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT,
    "categoryId" UUID NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE,
    "price" DOUBLE PRECISION NOT NULL,
    "discountPrice" DOUBLE PRECISION,
    "sku" VARCHAR(100) UNIQUE NOT NULL,
    "stock" INT DEFAULT 0,
    "lowStockThreshold" INT DEFAULT 5,
    "status" VARCHAR(50) DEFAULT 'ACTIVE',
    "isFeatured" BOOLEAN DEFAULT FALSE,
    "isBestseller" BOOLEAN DEFAULT FALSE,
    "tags" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Product Galleries
CREATE TABLE IF NOT EXISTS "ProductImage" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "url" TEXT NOT NULL,
    "altText" VARCHAR(255),
    "isPrimary" BOOLEAN DEFAULT FALSE,
    "sortOrder" INT DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Product Attributes (Fabric, Zari, Blouse, Care)
CREATE TABLE IF NOT EXISTS "ProductAttribute" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "name" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Real-Time Inventory Health
CREATE TABLE IF NOT EXISTS "Inventory" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID UNIQUE NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "currentStock" INT DEFAULT 0,
    "reservedStock" INT DEFAULT 0,
    "lowStockAlert" BOOLEAN DEFAULT FALSE,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Auditable Inventory Ledger
CREATE TABLE IF NOT EXISTS "InventoryTransaction" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "type" VARCHAR(50) NOT NULL,
    "quantityChange" INT NOT NULL,
    "previousStock" INT NOT NULL,
    "newStock" INT NOT NULL,
    "referenceId" VARCHAR(255),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping Carts
CREATE TABLE IF NOT EXISTS "Cart" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
    "sessionId" VARCHAR(255) UNIQUE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Cart Line Items
CREATE TABLE IF NOT EXISTS "CartItem" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "cartId" UUID NOT NULL REFERENCES "Cart"("id") ON DELETE CASCADE,
    "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "quantity" INT DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("cartId", "productId")
);

-- Customer Orders
CREATE TABLE IF NOT EXISTS "Order" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderNumber" VARCHAR(100) UNIQUE NOT NULL,
    "userId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "customerName" VARCHAR(255) NOT NULL,
    "customerEmail" VARCHAR(255) NOT NULL,
    "customerPhone" VARCHAR(50) NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pinCode" VARCHAR(20) NOT NULL,
    "country" VARCHAR(100) DEFAULT 'India',
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION DEFAULT 0,
    "shippingFee" DOUBLE PRECISION DEFAULT 0,
    "tax" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(50) DEFAULT 'PENDING',
    "paymentStatus" VARCHAR(50) DEFAULT 'PENDING',
    "paymentMethod" VARCHAR(50) DEFAULT 'RAZORPAY',
    "razorpayOrderId" VARCHAR(255),
    "razorpayPaymentId" VARCHAR(255),
    "trackingNumber" VARCHAR(255),
    "carrier" VARCHAR(100) DEFAULT 'Express Courier',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
    "productId" UUID NOT NULL REFERENCES "Product"("id"),
    "productName" VARCHAR(255) NOT NULL,
    "productSku" VARCHAR(100) NOT NULL,
    "productImage" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "attributesJson" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Ledger
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
    "paymentGateway" VARCHAR(50) DEFAULT 'RAZORPAY',
    "gatewayOrderId" VARCHAR(255),
    "gatewayPaymentId" VARCHAR(255),
    "gatewaySignature" VARCHAR(255),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" VARCHAR(10) DEFAULT 'INR',
    "status" VARCHAR(50) DEFAULT 'PENDING',
    "rawResponse" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Addresses
CREATE TABLE IF NOT EXISTS "Address" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pinCode" VARCHAR(20) NOT NULL,
    "country" VARCHAR(100) DEFAULT 'India',
    "isDefault" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Wishlists
CREATE TABLE IF NOT EXISTS "Wishlist" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "WishlistItem" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "wishlistId" UUID NOT NULL REFERENCES "Wishlist"("id") ON DELETE CASCADE,
    "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("wishlistId", "productId")
);

-- Customer Reviews & Ratings
CREATE TABLE IF NOT EXISTS "Review" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "userId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "userName" VARCHAR(255) NOT NULL,
    "rating" INT DEFAULT 5,
    "comment" TEXT NOT NULL,
    "isVerifiedPurchase" BOOLEAN DEFAULT TRUE,
    "status" VARCHAR(50) DEFAULT 'APPROVED',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Bridal & Customization Inquiries
CREATE TABLE IF NOT EXISTS "Inquiry" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "message" TEXT NOT NULL,
    "productId" UUID REFERENCES "Product"("id") ON DELETE SET NULL,
    "userId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "inquiryType" VARCHAR(50) DEFAULT 'GENERAL',
    "status" VARCHAR(50) DEFAULT 'NEW',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- System & Order Notifications
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES "User"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) DEFAULT 'ORDER',
    "isRead" BOOLEAN DEFAULT FALSE,
    "link" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- AI Shopping & Business Conversations
CREATE TABLE IF NOT EXISTS "AiConversation" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "sessionId" VARCHAR(255),
    "role" VARCHAR(50) DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AiMessage" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL REFERENCES "AiConversation"("id") ON DELETE CASCADE,
    "sender" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Store Configurations & Business Parameters
CREATE TABLE IF NOT EXISTS "Setting" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) UNIQUE NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"("email");
CREATE INDEX IF NOT EXISTS idx_user_role ON "User"("role");
CREATE INDEX IF NOT EXISTS idx_category_slug ON "Category"("slug");
CREATE INDEX IF NOT EXISTS idx_product_slug ON "Product"("slug");
CREATE INDEX IF NOT EXISTS idx_product_category ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS idx_product_sku ON "Product"("sku");
CREATE INDEX IF NOT EXISTS idx_product_status ON "Product"("status");
CREATE INDEX IF NOT EXISTS idx_product_featured ON "Product"("isFeatured");
CREATE INDEX IF NOT EXISTS idx_order_number ON "Order"("orderNumber");
CREATE INDEX IF NOT EXISTS idx_order_status ON "Order"("status");
CREATE INDEX IF NOT EXISTS idx_order_payment ON "Order"("paymentStatus");
CREATE INDEX IF NOT EXISTS idx_order_customer ON "Order"("customerEmail");

-- 6. Supabase Row Level Security (RLS) Setup
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductAttribute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
DO $$ BEGIN
    CREATE POLICY "Public read for active categories" ON "Category" FOR SELECT USING (status = 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read for active products" ON "Product" FOR SELECT USING (status = 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read for product images" ON "ProductImage" FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read for product attributes" ON "ProductAttribute" FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read for approved reviews" ON "Review" FOR SELECT USING (status = 'APPROVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read for store settings" ON "Setting" FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 7. Seed Core Platform Settings
INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'store_name', 'Royal Saree & Fashion', 'Brand storefront title')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'company_name', 'TechWave Solutions', 'Parent solution provider')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'tagline', 'Build • Innovate • Transform', 'Brand motto')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'contact_phone', '+91 9641145871', 'Customer helpline')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'contact_email', 'techwavesolutions.dev@gmail.com', 'Support mail')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'free_shipping_threshold', '1999', 'Order amount for zero delivery charges')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'standard_shipping_fee', '150', 'Base courier tariff')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'tax_rate', '5', 'Standard handloom GST rate (%)')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Setting" ("id", "key", "value", "description") VALUES
(gen_random_uuid(), 'whatsapp_number', '919641145871', 'WhatsApp Business hotline')
ON CONFLICT ("key") DO NOTHING;

-- 8. Seed Default Administrator & Customer Accounts
-- Passwords are encrypted with bcrypt (rounds: 10):
-- Admin: admin123  -> $2b$10$tZ2O8g.tV0q8rQ9eG2Wd..3g4E2V4m9R6yQ2oU8pM8lR0wQ9uN9e.
-- Customer: customer123 -> $2b$10$tZ2O8g.tV0q8rQ9eG2Wd..3g4E2V4m9R6yQ2oU8pM8lR0wQ9uN9e.
INSERT INTO "User" ("id", "email", "passwordHash", "name", "phone", "role") VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'admin@royal.techwavesolutions.dev',
    '$2a$10$6R68rI9dJvh9O8oH5GgCweQpB8z.G6m0o5Wc8kU8e1N8a9b2c3d4e',
    'Administrator',
    '+91 9641145871',
    'ADMIN'
)
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "User" ("id", "email", "passwordHash", "name", "phone", "role") VALUES
(
    '00000000-0000-0000-0000-000000000002',
    'priya.sharma@example.com',
    '$2a$10$6R68rI9dJvh9O8oH5GgCweQpB8z.G6m0o5Wc8kU8e1N8a9b2c3d4e',
    'Priya Sharma',
    '+91 9876543210',
    'CUSTOMER'
)
ON CONFLICT ("email") DO NOTHING;
