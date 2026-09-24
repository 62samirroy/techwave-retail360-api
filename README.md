# TechWave Retail360 — Backend API Repository

Production-ready RESTful API backend for **TechWave Retail360** (Demo Business: *Royal Saree & Fashion*).

## Technology Stack
- **Runtime**: Node.js & TypeScript
- **Framework**: Express.js with CORS, Cookie-Parser
- **Database**: Prisma ORM with SQLite (seamlessly swappable to PostgreSQL / Supabase)
- **Authentication**: JWT & HTTP-Only cookies with bcryptjs
- **Payments**: Razorpay Test Mode with server-side HMAC-SHA256 signature verification
- **AI Architecture**: Grounded AI service with controlled tools & offline rule-based NLP fallback
- **Inventory Engine**: Real-time stock audit transactions & auto-deductions

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup database and seed 20+ realistic products & demo accounts
npm run db:generate
npm run db:push
npm run db:seed

# 3. Start development server (Port 5000)
npm run dev
```

## 🐘 PostgreSQL & Supabase Integration

This backend is architected for **PostgreSQL** and **Supabase Cloud**:

### Option 1: Instant 1-Click Supabase SQL Setup
1. Open your project on [Supabase.com](https://supabase.com).
2. Go to **SQL Editor** in the left sidebar.
3. Open [`prisma/supabase_schema.sql`](file:///c:/Users/Abcom/Desktop/Personal/api/prisma/supabase_schema.sql), copy the entire SQL script, and click **Run**.
4. All 18 tables, UUID types, performance indexes, RLS policies, core settings, and seed records will be instantly created!

### Option 2: Prisma Direct Push to Supabase / PostgreSQL
1. In `api/.env`, set your connection strings:
   ```env
   DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   SUPABASE_URL="https://[PROJECT-REF].supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   ```
2. Push the PostgreSQL schema:
   ```bash
   npm run db:push:pg
   ```
3. Open Prisma Studio for your PostgreSQL database:
   ```bash
   npm run db:studio:pg
   ```


## Demo Credentials
- **Admin**: `admin@royal.techwavesolutions.dev` | `admin123`
- **Customer**: `priya.sharma@example.com` | `customer123`

## RESTful Endpoints
- `GET /health` — Health check
- `POST /api/auth/login` — Session login
- `POST /api/auth/register` — Customer registration
- `GET /api/auth/me` — Current authenticated session
- `POST /api/auth/logout` — Terminate session
- `GET /api/products` — Filtered products with search, pagination, and sorting
- `GET /api/products/:id` — Single product details
- `POST /api/products` — Admin create product
- `PUT /api/products/:id` — Admin update product & stock
- `DELETE /api/products/:id` — Admin delete product
- `GET /api/categories` — Product categories
- `GET /api/cart` — Cart items & price breakdown
- `POST /api/cart` — Add to cart with stock validation
- `POST /api/payments/razorpay/create-order` — Create Razorpay order
- `POST /api/payments/razorpay/verify` — Verify signature, confirm order, deduct stock
- `GET /api/orders` — Orders list (isolated by role)
- `GET /api/orders/track` — Public order tracking by Order Number
- `GET /api/inventory` — Stock levels & low stock alerts
- `POST /api/inventory/adjust` — Admin stock adjustments
- `GET /api/analytics` — Real-time revenue, order stats & category breakdown
- `POST /api/ai/customer` — Grounded AI Customer Assistant
- `POST /api/ai/business` — Admin-only AI Business Intelligence Assistant
