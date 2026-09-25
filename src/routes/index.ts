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
import { AddressesController } from '../controllers/addresses.controller';
import { NotificationsController } from '../controllers/notifications.controller';
import { AnalyticsController } from '../controllers/analytics.controller';
import { AIController } from '../controllers/ai.controller';
import { SettingsController } from '../controllers/settings.controller';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Rate limiters for abuse prevention
const authLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many authentication attempts. Please try again after 15 minutes.' });
const otpLimiter = rateLimiter({ windowMs: 10 * 60 * 1000, max: 10, message: 'Too many OTP requests. Please wait a few minutes before trying again.' });
const paymentLimiter = rateLimiter({ windowMs: 10 * 60 * 1000, max: 30, message: 'Too many payment verification attempts. Please wait.' });

// Auth routes
router.post('/auth/login', authLimiter, AuthController.login);
router.post('/auth/register', authLimiter, AuthController.register);
router.post('/auth/register/send-code', otpLimiter, AuthController.sendRegisterCode);
router.post('/auth/register/verify', authLimiter, AuthController.verifyRegisterCode);
router.post('/auth/google', authLimiter, AuthController.googleAuth);
router.post('/auth/phone/send-otp', otpLimiter, AuthController.sendPhoneOtp);
router.post('/auth/phone/verify-otp', authLimiter, AuthController.verifyPhoneOtp);
router.get('/auth/me', AuthController.me);
router.put('/auth/profile', requireAuth, AuthController.updateProfile);
router.put('/auth/change-password', requireAuth, AuthController.changePassword);
router.post('/auth/forgot-password', otpLimiter, AuthController.forgotPassword);
router.post('/auth/reset-password', authLimiter, AuthController.resetPassword);
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
router.post('/payments/razorpay/verify', paymentLimiter, PaymentsController.verifyPayment);
router.post('/payments/cod/confirm', PaymentsController.confirmCod);

// Orders
router.get('/orders', requireAuth, OrdersController.getAll);
router.get('/orders/track', OrdersController.track);
router.get('/orders/:id', OrdersController.getById);
router.patch('/orders/:id', requireAdmin, OrdersController.update);

// Addresses (Saved delivery addresses)
router.get('/addresses', requireAuth, AddressesController.getAll);
router.post('/addresses', requireAuth, AddressesController.create);
router.put('/addresses/:id', requireAuth, AddressesController.update);
router.delete('/addresses/:id', requireAuth, AddressesController.delete);
router.patch('/addresses/:id/default', requireAuth, AddressesController.setDefault);

// Notifications
router.get('/notifications', requireAuth, NotificationsController.getAll);
router.patch('/notifications/:id/read', requireAuth, NotificationsController.markRead);
router.patch('/notifications/read-all', requireAuth, NotificationsController.markAllRead);

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
router.get('/reviews/eligibility', ReviewsController.checkEligibility);
router.post('/reviews', requireAuth, ReviewsController.create);
router.get('/admin/reviews', requireAdmin, ReviewsController.getAllAdmin);
router.patch('/admin/reviews/:id', requireAdmin, ReviewsController.updateStatus);
router.delete('/admin/reviews/:id', requireAdmin, ReviewsController.delete);

// Wishlist
router.get('/wishlist', WishlistController.getWishlist);
router.post('/wishlist', WishlistController.toggle);
router.post('/wishlist/move-to-cart', requireAuth, WishlistController.moveToCart);

// Analytics
router.get('/analytics', requireAdmin, AnalyticsController.getSummary);

// AI
router.post('/ai/customer', AIController.customerChat);
router.post('/ai/business', requireAdmin, AIController.businessChat);

// Settings
router.get('/settings', SettingsController.getSettings);
router.put('/settings', requireAdmin, SettingsController.updateSettings);

export default router;
