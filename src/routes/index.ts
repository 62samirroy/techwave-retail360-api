import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { ProductsController } from '../controllers/products.controller';
import { CategoriesController } from '../controllers/categories.controller';
import { CartController } from '../controllers/cart.controller';
import { PaymentsController } from '../controllers/payments.controller';
import { OrdersController } from '../controllers/orders.controller';
import { InventoryController } from '../controllers/inventory.controller';
import { CustomersController } from '../controllers/customers.controller';
import { InquiriesController } from '../controllers/inquiries.controller';
import { ReviewsController } from '../controllers/reviews.controller';
import { WishlistController } from '../controllers/wishlist.controller';
import { AnalyticsController } from '../controllers/analytics.controller';
import { AIController } from '../controllers/ai.controller';
import { SettingsController } from '../controllers/settings.controller';
import { requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

// Auth routes
router.post('/auth/login', AuthController.login);
router.post('/auth/register', AuthController.register);
router.get('/auth/me', AuthController.me);
router.post('/auth/logout', AuthController.logout);

// Products routes
router.get('/products', ProductsController.getAll);
router.get('/products/:id', ProductsController.getById);
router.post('/products', requireAdmin, ProductsController.create);
router.put('/products/:id', requireAdmin, ProductsController.update);
router.delete('/products/:id', requireAdmin, ProductsController.delete);

// Categories routes
router.get('/categories', CategoriesController.getAll);
router.post('/categories', requireAdmin, CategoriesController.create);
router.put('/categories/:id', requireAdmin, CategoriesController.update);
router.delete('/categories/:id', requireAdmin, CategoriesController.delete);

// Cart routes
router.get('/cart', CartController.getCart);
router.post('/cart', CartController.addItem);
router.put('/cart/:itemId', CartController.updateItem);
router.delete('/cart/:itemId', CartController.removeItem);
router.delete('/cart', CartController.clearCart);

// Payments & Checkout
router.post('/payments/razorpay/create-order', PaymentsController.createRazorpayOrder);
router.post('/payments/razorpay/verify', PaymentsController.verifyPayment);

// Orders
router.get('/orders', requireAuth, OrdersController.getAll);
router.get('/orders/track', OrdersController.track);
router.get('/orders/:id', OrdersController.getById);
router.patch('/orders/:id', requireAdmin, OrdersController.update);

// Inventory
router.get('/inventory', requireAdmin, InventoryController.getAll);
router.post('/inventory/adjust', requireAdmin, InventoryController.adjust);
router.get('/inventory/history', requireAdmin, InventoryController.getHistory);

// Customers
router.get('/customers', requireAdmin, CustomersController.getAll);

// Inquiries
router.get('/inquiries', requireAdmin, InquiriesController.getAll);
router.post('/inquiries', InquiriesController.create);
router.patch('/inquiries/:id', requireAdmin, InquiriesController.update);

// Reviews
router.get('/reviews', ReviewsController.getByProduct);
router.post('/reviews', ReviewsController.create);

// Wishlist
router.get('/wishlist', WishlistController.getWishlist);
router.post('/wishlist', WishlistController.toggle);

// Analytics
router.get('/analytics', requireAdmin, AnalyticsController.getSummary);

// AI
router.post('/ai/customer', AIController.customerChat);
router.post('/ai/business', requireAdmin, AIController.businessChat);

// Settings
router.get('/settings', SettingsController.getSettings);
router.put('/settings', requireAdmin, SettingsController.updateSettings);

export default router;
