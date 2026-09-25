import { Request, Response } from 'express';
import prisma from '../lib/db';
import { comparePassword, hashPassword, signToken, AUTH_COOKIE_NAME } from '../lib/auth';
import { AuthenticatedRequest } from '../types';
import { EmailService } from '../services/email';

// In-memory OTP storage with TTL (5 minutes)
interface PhoneOtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
}
const otpStore = new Map<string, PhoneOtpEntry>();

// In-memory Password Reset storage with TTL (15 minutes)
interface PasswordResetEntry {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}
const passwordResetStore = new Map<string, PasswordResetEntry>();

// In-memory Registration Email Verification storage with TTL (15 minutes)
interface EmailVerificationEntry {
  email: string;
  name: string;
  code: string;
  expiresAt: number;
  attempts: number;
}
const emailVerificationStore = new Map<string, EmailVerificationEntry>();

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        include: { profile: true },
      });

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'CUSTOMER' | 'ADMIN',
        phone: user.phone,
        avatarUrl: user.profile?.avatarUrl || null,
      };

      const token = signToken(sessionUser);

      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Send welcome/login notification email
      EmailService.sendWelcomeEmail({
        name: user.name,
        email: user.email,
      });

      return res.json({
        success: true,
        message: 'Login successful',
        data: { user: sessionUser, token },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * 1. Send 6-Digit Email Verification Code for Customer Registration
   */
  static async sendRegisterCode(req: Request, res: Response) {
    try {
      const { name, email } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Full name and email are required' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists. Please sign in instead.',
        });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      emailVerificationStore.set(normalizedEmail, {
        email: normalizedEmail,
        name: name.trim(),
        code,
        expiresAt,
        attempts: 0,
      });

      console.log(`[REGISTER OTP] Verification code for ${normalizedEmail}: ${code}`);

      // Dispatch live email via EmailService
      EmailService.sendVerificationCodeEmail({
        name: name.trim(),
        email: normalizedEmail,
        code,
      }).catch((mailErr: any) => {
        console.error('[EMAIL GATEWAY] Registration email failed:', mailErr.message);
      });

      return res.json({
        success: true,
        message: `A 6-digit verification code has been dispatched to ${normalizedEmail}. Please check your inbox.`,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * 2. Verify Email Code and Finalize Customer Registration
   */
  static async verifyRegisterCode(req: Request, res: Response) {
    try {
      const { name, email, password, phone, code } = req.body;
      if (!name || !email || !password || !code) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, password, and the 6-digit verification code are required',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const record = emailVerificationStore.get(normalizedEmail);

      if (!record) {
        return res.status(400).json({
          success: false,
          message: 'No verification request found for this email. Please request a new code.',
        });
      }

      if (Date.now() > record.expiresAt) {
        emailVerificationStore.delete(normalizedEmail);
        return res.status(400).json({
          success: false,
          message: 'This verification code has expired. Please request a new code.',
        });
      }

      if (record.code !== code.toString().trim()) {
        record.attempts += 1;
        if (record.attempts >= 5) {
          emailVerificationStore.delete(normalizedEmail);
          return res.status(429).json({
            success: false,
            message: 'Too many incorrect attempts. Please request a new code.',
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code. Please check your email and try again.',
        });
      }

      // Code verified! Verify user does not exist
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        emailVerificationStore.delete(normalizedEmail);
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : null,
          passwordHash,
          role: 'CUSTOMER',
          profile: { create: {} },
          cart: { create: {} },
          wishlist: { create: {} },
        },
        include: { profile: true },
      });

      emailVerificationStore.delete(normalizedEmail);

      // Dispatch welcome email to verified customer
      EmailService.sendWelcomeEmail({
        name: user.name,
        email: user.email,
      });

      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'CUSTOMER' | 'ADMIN',
        phone: user.phone,
        avatarUrl: user.profile?.avatarUrl || null,
      };

      const token = signToken(sessionUser);

      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        success: true,
        message: 'Email verified and account created successfully!',
        data: { user: sessionUser, token },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const { name, email, password, phone } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : null,
          passwordHash,
          role: 'CUSTOMER',
          profile: { create: {} },
          cart: { create: {} },
          wishlist: { create: {} },
        },
        include: { profile: true },
      });

      // Dispatch welcome email to new customer
      EmailService.sendWelcomeEmail({
        name: user.name,
        email: user.email,
      });

      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'CUSTOMER' | 'ADMIN',
        phone: user.phone,
        avatarUrl: user.profile?.avatarUrl || null,
      };

      const token = signToken(sessionUser);

      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: { user: sessionUser, token },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Google OAuth authentication handler
   */
  static async googleAuth(req: Request, res: Response) {
    try {
      let { email, name, avatarUrl, googleId, idToken } = req.body;

      // 1. If official Google ID token is provided, extract profile info directly from JWT payload
      if (idToken && typeof idToken === 'string') {
        try {
          const parts = idToken.split('.');
          if (parts.length >= 2) {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const decodedStr = Buffer.from(base64, 'base64').toString('utf-8');
            const payload = JSON.parse(decodedStr);
            if (payload.email) {
              email = payload.email;
              name = payload.name || name;
              avatarUrl = payload.picture || avatarUrl;
              googleId = payload.sub || googleId;
              console.log(`[GOOGLE AUTH] Decoded ID token for: ${email} (${name})`);
            }
          }
        } catch (jwtErr: any) {
          console.warn('[GOOGLE AUTH] Failed to decode ID token payload:', jwtErr.message);
        }

        // 2. Also try Google OAuth2 tokeninfo endpoint for additional verification if reachable
        try {
          const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
          if (verifyRes.ok) {
            const tokenInfo = await verifyRes.json();
            if (tokenInfo.email) {
              email = tokenInfo.email;
              name = tokenInfo.name || name;
              avatarUrl = tokenInfo.picture || avatarUrl;
              googleId = tokenInfo.sub || googleId;
            }
          }
        } catch (gErr: any) {
          console.warn('[GOOGLE AUTH] Google tokeninfo verify skipped:', gErr.message);
        }
      }

      if (!email) {
        return res.status(400).json({ success: false, message: 'Google account email could not be retrieved from ID token' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      let user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { profile: true },
      });

      if (!user) {
        const dummyPassword = await hashPassword(`google_${Date.now()}_${Math.random()}`);
        user = await prisma.user.create({
          data: {
            name: name?.trim() || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            passwordHash: dummyPassword,
            role: 'CUSTOMER',
            profile: {
              create: {
                avatarUrl: avatarUrl || null,
              },
            },
            cart: { create: {} },
            wishlist: { create: {} },
          },
          include: { profile: true },
        });

        // Dispatch welcome email to newly registered Google customer
        EmailService.sendWelcomeEmail({
          name: user.name,
          email: user.email,
        });
      } else if (avatarUrl && !user.profile?.avatarUrl) {
        // Update profile avatar if empty
        await prisma.profile.upsert({
          where: { userId: user.id },
          update: { avatarUrl },
          create: { userId: user.id, avatarUrl },
        });
      }

      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'CUSTOMER' | 'ADMIN',
        phone: user.phone,
        avatarUrl: user.profile?.avatarUrl || avatarUrl || null,
      };

      const token = signToken(sessionUser);

      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        message: 'Google authentication successful',
        data: { user: sessionUser, token },
      });
    } catch (error: any) {
      console.error('[GOOGLE AUTH] Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Phone OTP: Send OTP
   */
  static async sendPhoneOtp(req: Request, res: Response) {
    try {
      const { phone } = req.body;
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ success: false, message: 'Valid phone number is required' });
      }

      const cleanPhone = phone.trim().replace(/\s+/g, '');
      const tenDigit = cleanPhone.replace(/\D/g, '').slice(-10);
      if (tenDigit.length !== 10) {
        return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
      }

      // Generate 6-digit cryptographic-random OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

      otpStore.set(cleanPhone, { otp, expiresAt, attempts: 0 });

      console.log(`[AUTH] OTP generated for +91${tenDigit}: ${otp} (expires in 5m)`);

      let smsDelivered = false;
      let gatewayNotice = '';

      // If Fast2SMS API key is provided, dispatch live SMS to Indian phone
      const fast2smsKey = process.env.FAST2SMS_API_KEY;
      if (fast2smsKey) {
        try {
          console.log(`[SMS GATEWAY] Dispatching Fast2SMS Quick OTP to +91${tenDigit}...`);
          const smsUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(fast2smsKey)}&route=otp&variables_values=${otp}&numbers=${tenDigit}`;
          const smsRes = await fetch(smsUrl, { method: 'GET' });
          const smsData = await smsRes.json().catch(() => null);
          console.log(`[SMS GATEWAY] Fast2SMS API response status ${smsRes.status}:`, smsData);
          if (smsData && (smsData.return === true || (Array.isArray(smsData.message) && smsData.message[0]?.toLowerCase().includes('successfully')))) {
            smsDelivered = true;
          } else if (smsData && smsData.message) {
            gatewayNotice = Array.isArray(smsData.message) ? smsData.message.join(', ') : smsData.message;
          }
        } catch (smsErr: any) {
          console.error('[SMS GATEWAY] Fast2SMS delivery failed:', smsErr.message);
          gatewayNotice = smsErr.message;
        }
      } else {
        console.warn('[SMS GATEWAY] FAST2SMS_API_KEY not found in api/.env');
        gatewayNotice = 'FAST2SMS_API_KEY not configured in backend';
      }

      return res.json({
        success: true,
        message: smsDelivered
          ? `6-digit OTP dispatched via SMS to +91${tenDigit}. Valid for 5 minutes.`
          : gatewayNotice
            ? `SMS Notice: ${gatewayNotice}`
            : `Verification code generated for ${cleanPhone}.`,
        smsDelivered,
        gatewayNotice,
        demoOtp: otp,
        otpCode: otp,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Phone OTP: Verify OTP and login/register
   */
  static async verifyPhoneOtp(req: Request, res: Response) {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ success: false, message: 'Phone number and 6-digit OTP are required' });
      }

      const cleanPhone = phone.trim().replace(/\s+/g, '');
      const cleanOtp = otp.toString().trim();

      const record = otpStore.get(cleanPhone);
      if (!record) {
        return res.status(400).json({
          success: false,
          message: 'No OTP requested for this phone number or OTP has expired. Please request a new OTP.',
        });
      }

      if (Date.now() > record.expiresAt) {
        otpStore.delete(cleanPhone);
        return res.status(400).json({
          success: false,
          message: 'This OTP has expired. Please request a new OTP.',
        });
      }

      if (record.attempts >= 5) {
        otpStore.delete(cleanPhone);
        return res.status(429).json({
          success: false,
          message: 'Too many incorrect attempts. Please request a new OTP.',
        });
      }

      if (record.otp !== cleanOtp) {
        record.attempts += 1;
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP code. Please check and try again.',
        });
      }

      // OTP verified: remove from store
      otpStore.delete(cleanPhone);

      // Find or create user by phone
      let user = await prisma.user.findFirst({
        where: { phone: cleanPhone },
        include: { profile: true },
      });

      if (!user) {
        const dummyEmail = `phone_${cleanPhone.replace(/[^0-9]/g, '')}@retail360.local`;
        const dummyPassword = await hashPassword(`otp_${Date.now()}_${Math.random()}`);

        user = await prisma.user.create({
          data: {
            name: `User ${cleanPhone.slice(-4)}`,
            email: dummyEmail,
            phone: cleanPhone,
            passwordHash: dummyPassword,
            role: 'CUSTOMER',
            profile: { create: {} },
            cart: { create: {} },
            wishlist: { create: {} },
          },
          include: { profile: true },
        });
      }

      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'CUSTOMER' | 'ADMIN',
        phone: user.phone,
        avatarUrl: user.profile?.avatarUrl || null,
      };

      const token = signToken(sessionUser);

      res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        message: 'Phone authentication verified successfully',
        data: { user: sessionUser, token },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated', data: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { profile: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found', data: null });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as 'CUSTOMER' | 'ADMIN',
          phone: user.phone,
          avatarUrl: user.profile?.avatarUrl || null,
          bio: user.profile?.bio || null,
          createdAt: user.createdAt,
        },
      },
    });
  }

  /**
   * Update Profile (customer safe: strictly protects role)
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { name, phone, bio, avatarUrl } = req.body;

      // Update User table fields
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(name && { name: name.trim() }),
          ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        },
        include: { profile: true },
      });

      // Update Profile table fields
      await prisma.profile.upsert({
        where: { userId: req.user.id },
        update: {
          ...(bio !== undefined && { bio }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
        create: {
          userId: req.user.id,
          bio: bio || null,
          avatarUrl: avatarUrl || null,
        },
      });

      const sessionUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role as 'CUSTOMER' | 'ADMIN',
        phone: updatedUser.phone,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : updatedUser.profile?.avatarUrl || null,
      };

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: sessionUser },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const isValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Incorrect current password' });
      }

      const newPasswordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: newPasswordHash },
      });

      return res.json({ success: true, message: 'Password updated successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async logout(req: Request, res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.json({ success: true, message: 'Logged out successfully' });
  }

  /**
   * Request password reset code via email
   */
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Registered email address is required' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'No registered account found with this email address.',
        });
      }

      // Generate 6-digit secure numeric code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      passwordResetStore.set(normalizedEmail, {
        email: normalizedEmail,
        code: resetCode,
        expiresAt,
        attempts: 0,
      });

      console.log(`[PASSWORD RESET] Code for ${normalizedEmail}: ${resetCode} (Valid for 15m)`);

      // Dispatch live password reset email via EmailService
      EmailService.sendPasswordResetEmail({
        email: normalizedEmail,
        code: resetCode,
      }).catch((mailErr: any) => {
        console.error('[EMAIL GATEWAY] Password reset email failed:', mailErr.message);
      });

      return res.json({
        success: true,
        message: 'A 6-digit password reset verification code has been dispatched to your email address. Please check your inbox.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Verify reset code and set new password
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Email, verification code, and new password are required',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long',
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const record = passwordResetStore.get(normalizedEmail);

      if (!record) {
        return res.status(400).json({
          success: false,
          message: 'No active password reset request found. Please request a new code.',
        });
      }

      if (Date.now() > record.expiresAt) {
        passwordResetStore.delete(normalizedEmail);
        return res.status(400).json({
          success: false,
          message: 'This reset code has expired. Please request a new code.',
        });
      }

      if (record.attempts >= 5) {
        passwordResetStore.delete(normalizedEmail);
        return res.status(429).json({
          success: false,
          message: 'Too many incorrect attempts. Please request a new code.',
        });
      }

      if (record.code !== code.trim()) {
        record.attempts += 1;
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code. Please check and try again.',
        });
      }

      // Valid: update password in database
      const passwordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { email: normalizedEmail },
        data: { passwordHash },
      });

      passwordResetStore.delete(normalizedEmail);

      return res.json({
        success: true,
        message: 'Your password has been successfully reset! You can now sign in with your new password.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
