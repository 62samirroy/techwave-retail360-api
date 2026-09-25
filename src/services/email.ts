/**
 * Centralized Email Service for TECHWAVE RETAIL360 (Royal Saree & Fashion)
 * Powered by Resend REST API with automatic domain validation & sandbox fallback.
 */

export interface EmailRecipient {
  name?: string;
  email: string;
}

export interface OrderItemSummary {
  productName: string;
  productSku?: string | null;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  shippingAddress: string;
  city: string;
  state: string;
  pinCode: string;
  country?: string;
  subtotal: number;
  shippingFee: number;
  tax: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  status?: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  items: OrderItemSummary[];
  createdAt?: Date | string;
}

import nodemailer from 'nodemailer';

export class EmailService {
  private static readonly RESEND_API_URL = 'https://api.resend.com/emails';
  private static readonly DEV_FALLBACK_EMAIL = 'techwavesolutions.dev@gmail.com';
  private static readonly STORE_NAME = 'Royal Saree & Fashion';
  private static readonly STORE_TAGLINE = 'TechWave Retail360 • Handcrafted Indian Heritage';
  private static readonly WHATSAPP_NUMBER = process.env.WHATSAPP_PHONE || '+919641145871';

  private static getClientUrl(): string {
    return process.env.CLIENT_URL || 'http://localhost:3000';
  }

  private static getFromAddress(): string {
    const envFrom = process.env.EMAIL_FROM || 'Royal Saree & Fashion <onboarding@resend.dev>';
    // Public webmails (gmail/yahoo/outlook) cannot be used as sender on Resend
    if (
      envFrom.includes('@gmail.com') ||
      envFrom.includes('@yahoo.com') ||
      envFrom.includes('@outlook.com') ||
      envFrom.includes('@hotmail.com')
    ) {
      return 'Royal Saree & Fashion <onboarding@resend.dev>';
    }
    return envFrom;
  }

  /**
   * Direct SMTP Transporter (e.g. Gmail SMTP)
   * Sends directly to ANY recipient without domain verification restrictions
   */
  private static getSmtpTransporter() {
    const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD;
    if (!smtpPass) return null;

    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT) || 465;
    const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || 'techwavesolutions.dev@gmail.com';

    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass.replace(/\s+/g, ''),
      },
    });
  }

  /**
   * Dual-engine sender:
   * 1. If SMTP (Gmail SMTP) is configured, sends directly to ANY user email without restriction.
   * 2. Otherwise sends via Resend REST API.
   */
  private static async send(options: {
    to: string;
    subject: string;
    html: string;
    category?: string;
  }): Promise<{ success: boolean; id?: string; message?: string }> {
    const primaryTo = options.to.toLowerCase().trim();

    // 1. Try Direct SMTP first (Allows delivering to ALL user inboxes without Resend domain restrictions)
    const transporter = this.getSmtpTransporter();
    if (transporter) {
      try {
        const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || 'techwavesolutions.dev@gmail.com';
        const fromHeader = `"${this.STORE_NAME}" <${smtpUser}>`;
        console.log(`[EMAIL SERVICE] Sending "${options.subject}" directly to customer ${primaryTo} via SMTP (${smtpUser})...`);

        const info = await transporter.sendMail({
          from: fromHeader,
          to: primaryTo,
          subject: options.subject,
          html: options.html,
        });

        console.log(`[EMAIL SERVICE] Successfully delivered email to customer ${primaryTo}. Message ID: ${info.messageId}`);
        return { success: true, id: info.messageId };
      } catch (smtpErr: any) {
        console.error(`[EMAIL SERVICE] SMTP delivery failed to ${primaryTo}:`, smtpErr.message);
      }
    }

    // 2. Resend REST API Engine
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(`[EMAIL SERVICE] Skipped "${options.subject}" to ${primaryTo}: Neither SMTP_PASS nor RESEND_API_KEY configured.`);
      return { success: false, message: 'No email credentials configured' };
    }

    const from = this.getFromAddress();

    try {
      console.log(`[EMAIL SERVICE] Sending "${options.subject}" to ${primaryTo} via Resend (from: ${from})...`);

      const res = await fetch(this.RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Retail360Node/1.0',
        },
        body: JSON.stringify({
          from,
          to: [primaryTo],
          subject: options.subject,
          html: options.html,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        console.log(`[EMAIL SERVICE] Successfully sent email to ${primaryTo} via Resend. Resend ID: ${data?.id || 'OK'}`);
        return { success: true, id: data?.id };
      }

      // If Resend returns 403 or 422 because free tier only allows sending to the registered account email
      const errorMsg = data?.message || data?.error?.message || '';
      console.warn(`[EMAIL SERVICE] Resend rejected direct delivery to ${primaryTo} (HTTP ${res.status}): ${errorMsg}`);

      if (res.status === 403 || res.status === 422) {
        console.warn(`[EMAIL SERVICE] IMPORTANT: Resend test domain (${from}) restricts recipients to registered account (${this.DEV_FALLBACK_EMAIL}).`);
        console.warn(`[EMAIL SERVICE] To deliver directly to customer (${primaryTo}), add a Gmail App Password in api/.env (SMTP_PASS="...") or verify your domain at resend.com/domains.`);
      }

      if (!res.ok && primaryTo !== this.DEV_FALLBACK_EMAIL.toLowerCase()) {
        const fallbackHtml = `
          <div style="background:#FEF3C7;border:1px solid #F59E0B;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-family:sans-serif;font-size:13px;color:#92400E;line-height:1.5;">
            <strong>[Customer Email Sandbox Notice]</strong><br/>
            Intended Customer: <strong>${primaryTo}</strong><br/>
            Because Resend test mode (<em>onboarding@resend.dev</em>) restricts non-verified recipient domains, Resend refused delivery to the customer's personal address.<br/>
            This copy was forwarded to your verified developer email for review.<br/>
            <strong>To deliver directly to all customer inboxes:</strong> Add a Gmail App Password in <code>api/.env</code> (SMTP_PASS) or verify your domain at resend.com/domains.
          </div>
          ${options.html}
        `;

        const fallbackRes = await fetch(this.RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Retail360Node/1.0',
          },
          body: JSON.stringify({
            from,
            to: [this.DEV_FALLBACK_EMAIL],
            subject: `[Customer: ${primaryTo}] ${options.subject}`,
            html: fallbackHtml,
          }),
        });

        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (fallbackRes.ok) {
          console.log(`[EMAIL SERVICE] Admin copy delivered to ${this.DEV_FALLBACK_EMAIL}. Resend ID: ${fallbackData?.id || 'OK'}`);
        }
      }

      return { success: false, message: errorMsg };
    } catch (err: any) {
      console.error(`[EMAIL SERVICE] Network error sending email to ${primaryTo}:`, err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * 1. Send Welcome Email upon successful registration / email verification
   */
  static async sendWelcomeEmail(recipient: EmailRecipient): Promise<any> {
    const clientUrl = this.getClientUrl();
    const customerName = recipient.name?.trim() || recipient.email.split('@')[0];
    const subject = `Welcome to Royal Saree & Fashion, ${customerName}! 🌸`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FDFBF7;padding:30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EBE3D5;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          
          <!-- Luxury Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #4A154B 0%, #2D082E 100%);padding:36px 30px;text-align:center;">
              <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#F6C56F;text-transform:uppercase;margin-bottom:8px;">
                ${this.STORE_TAGLINE}
              </div>
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;font-family:Georgia,serif;">
                Royal Saree &amp; Fashion
              </h1>
              <p style="margin:8px 0 0 0;font-size:13px;color:#E9D5FF;letter-spacing:1px;">
                TIMLESS INDIAN CRAFTSMANSHIP
              </p>
            </td>
          </tr>

          <!-- Welcome Body -->
          <tr>
            <td style="padding:36px 32px 24px 32px;">
              <p style="font-size:18px;font-weight:600;color:#4A154B;margin:0 0 16px 0;">
                Namaste ${customerName}, 🙏
              </p>
              <p style="font-size:15px;line-height:1.7;color:#4B5563;margin:0 0 20px 0;">
                Welcome to the <strong>Royal Saree &amp; Fashion</strong> family! Your email has been verified and your customer account is now officially active.
              </p>
              <p style="font-size:15px;line-height:1.7;color:#4B5563;margin:0 0 28px 0;">
                We take immense pride in curating authentic, master-weaver handloom sarees—from pure Kanjivaram silks and Banarasi brocades to lightweight Chanderi and partywear georgettes.
              </p>

              <!-- Benefits Highlight Box -->
              <div style="background-color:#FAF5F0;border-left:4px solid #D97706;border-radius:8px;padding:20px 22px;margin-bottom:30px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#92400E;margin-bottom:12px;">
                  Your Member Privileges
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">
                      ✨ <strong>100% Authentic Handloom:</strong> Certified pure silk &amp; artisan quality.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">
                      🚚 <strong>Free Pan-India Delivery:</strong> On all orders above ₹1,999.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">
                      🔒 <strong>Safe &amp; Secure Checkout:</strong> Powered by Razorpay with instant tracking.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">
                      💬 <strong>Direct Artisan Support:</strong> Connect with us anytime via WhatsApp.
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Call to Action Button -->
              <div style="text-align:center;margin:32px 0 20px 0;">
                <a href="${clientUrl}/products" style="display:inline-block;background-color:#4A154B;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:30px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(74,21,75,0.3);">
                  Explore Our Collection &rarr;
                </a>
              </div>

              <div style="text-align:center;">
                <a href="${clientUrl}/dashboard" style="font-size:13px;color:#7C3AED;text-decoration:none;font-weight:500;">
                  Visit Your Account Dashboard &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9F9FB;border-top:1px solid #EEEEEE;padding:24px 30px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;">
                Have questions or styling requests? Chat with us on 
                <a href="https://wa.me/${this.WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}" style="color:#059669;font-weight:600;text-decoration:none;">WhatsApp (${this.WHATSAPP_NUMBER})</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                &copy; ${new Date().getFullYear()} ${this.STORE_NAME} • TechWave Retail360 Platform. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Return delivery promise
    return await this.send({ to: recipient.email, subject, html, category: 'welcome' });
  }

  /**
   * 2. Send Order Confirmation Email upon order placement & payment verification
   */
  static async sendOrderConfirmationEmail(order: OrderEmailData): Promise<any> {
    const clientUrl = this.getClientUrl();
    const customerName = order.customerName || 'Valued Customer';
    const subject = `Order Confirmed! #${order.orderNumber} - Royal Saree & Fashion`;

    // Build items HTML table rows
    const itemsHtml = order.items
      .map(
        (it) => `
        <tr style="border-bottom:1px solid #F3F4F6;">
          <td style="padding:14px 8px;font-size:14px;color:#1F2937;">
            <strong>${it.productName}</strong>
            ${it.productSku ? `<br/><span style="font-size:11px;color:#6B7280;">SKU: ${it.productSku}</span>` : ''}
          </td>
          <td align="center" style="padding:14px 8px;font-size:14px;color:#4B5563;">
            ${it.quantity}
          </td>
          <td align="right" style="padding:14px 8px;font-size:14px;color:#1F2937;font-weight:600;">
            ₹${it.total.toLocaleString('en-IN')}
          </td>
        </tr>
      `
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FDFBF7;padding:30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EBE3D5;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #4A154B 0%, #2D082E 100%);padding:32px 30px;text-align:center;">
              <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#F6C56F;text-transform:uppercase;margin-bottom:8px;">
                ORDER CONFIRMATION
              </div>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#FFFFFF;font-family:Georgia,serif;">
                Royal Saree &amp; Fashion
              </h1>
              <div style="margin-top:12px;display:inline-block;background-color:#D97706;color:#FFFFFF;font-size:13px;font-weight:700;padding:5px 16px;border-radius:20px;letter-spacing:0.5px;">
                Order #${order.orderNumber}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 20px 32px;">
              <p style="font-size:17px;font-weight:600;color:#4A154B;margin:0 0 12px 0;">
                Namaste ${customerName}, 🙏
              </p>
              <p style="font-size:15px;line-height:1.6;color:#4B5563;margin:0 0 24px 0;">
                Thank you for choosing <strong>Royal Saree &amp; Fashion</strong>! We have received your order and our artisan team is now preparing and packing your sarees with the highest standard of care.
              </p>

              <!-- Items Table -->
              <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4B5563;margin-bottom:8px;border-bottom:2px solid #4A154B;padding-bottom:6px;">
                Order Summary
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
                <thead>
                  <tr style="border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">
                    <th align="left" style="padding:8px 8px;">Item</th>
                    <th align="center" style="padding:8px 8px;">Qty</th>
                    <th align="right" style="padding:8px 8px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Pricing Calculation Breakdown -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:28px;background-color:#F9FAFB;border-radius:8px;padding:16px;">
                <tr>
                  <td style="padding:4px 10px;font-size:14px;color:#4B5563;">Subtotal:</td>
                  <td align="right" style="padding:4px 10px;font-size:14px;color:#1F2937;">₹${order.subtotal.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td style="padding:4px 10px;font-size:14px;color:#4B5563;">Shipping Fee:</td>
                  <td align="right" style="padding:4px 10px;font-size:14px;color:#059669;font-weight:600;">
                    ${order.shippingFee === 0 ? 'FREE' : `₹${order.shippingFee.toLocaleString('en-IN')}`}
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 10px;font-size:14px;color:#4B5563;">Taxes (GST 5%):</td>
                  <td align="right" style="padding:4px 10px;font-size:14px;color:#1F2937;">₹${order.tax.toLocaleString('en-IN')}</td>
                </tr>
                <tr style="border-top:1px solid #E5E7EB;">
                  <td style="padding:10px 10px 4px 10px;font-size:16px;font-weight:700;color:#4A154B;">Grand Total:</td>
                  <td align="right" style="padding:10px 10px 4px 10px;font-size:18px;font-weight:700;color:#4A154B;">₹${order.total.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:4px 10px 6px 10px;font-size:12px;color:#6B7280;">
                    Payment Method: <strong>${order.paymentMethod || 'Razorpay Online'}</strong> (${order.paymentStatus || 'PAID'})
                  </td>
                </tr>
              </table>

              <!-- Delivery Address Box -->
              <div style="background-color:#FAF5F0;border:1px solid #EBE3D5;border-radius:10px;padding:18px 20px;margin-bottom:30px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#92400E;margin-bottom:8px;">
                  📍 Delivery Address
                </div>
                <div style="font-size:14px;color:#1F2937;line-height:1.5;">
                  <strong>${order.customerName}</strong><br/>
                  ${order.shippingAddress}<br/>
                  ${order.city}, ${order.state} - ${order.pinCode}<br/>
                  ${order.country || 'India'}<br/>
                  ${order.customerPhone ? `<span style="font-size:12px;color:#6B7280;">Contact: ${order.customerPhone}</span>` : ''}
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="text-align:center;margin:28px 0 16px 0;">
                <a href="${clientUrl}/track-order?orderId=${order.orderNumber}" style="display:inline-block;background-color:#4A154B;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:30px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(74,21,75,0.25);">
                  Track Your Order Live &rarr;
                </a>
              </div>

              <div style="text-align:center;">
                <a href="${clientUrl}/dashboard" style="font-size:13px;color:#7C3AED;text-decoration:none;font-weight:500;">
                  View Order in Your Dashboard
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9F9FB;border-top:1px solid #EEEEEE;padding:24px 30px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;">
                Need help with your order? Reach our customer concierge via 
                <a href="https://wa.me/${this.WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}" style="color:#059669;font-weight:600;text-decoration:none;">WhatsApp (${this.WHATSAPP_NUMBER})</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                &copy; ${new Date().getFullYear()} ${this.STORE_NAME} • TechWave Retail360.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await this.send({ to: order.customerEmail, subject, html, category: 'order-confirmed' });
  }

  /**
   * 3. Send Order Delivered Email upon status change to DELIVERED
   */
  static async sendOrderDeliveredEmail(order: OrderEmailData): Promise<any> {
    const clientUrl = this.getClientUrl();
    const customerName = order.customerName || 'Valued Customer';
    const subject = `Your Order #${order.orderNumber} Has Been Delivered! 🎉 - Royal Saree & Fashion`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FDFBF7;padding:30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EBE3D5;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          
          <!-- Celebratory Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #065F46 0%, #064E3B 100%);padding:36px 30px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">🎁</div>
              <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#A7F3D0;text-transform:uppercase;margin-bottom:6px;">
                DELIVERED SUCCESSFULLY
              </div>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#FFFFFF;font-family:Georgia,serif;">
                Your Package Has Arrived!
              </h1>
              <div style="margin-top:12px;display:inline-block;background-color:#059669;color:#FFFFFF;font-size:13px;font-weight:700;padding:5px 16px;border-radius:20px;letter-spacing:0.5px;">
                Order #${order.orderNumber}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <p style="font-size:17px;font-weight:600;color:#065F46;margin:0 0 12px 0;">
                Namaste ${customerName}, 🙏
              </p>
              <p style="font-size:15px;line-height:1.7;color:#4B5563;margin:0 0 20px 0;">
                We are thrilled to let you know that your parcel for <strong>Order #${order.orderNumber}</strong> has been successfully delivered to your doorstep!
              </p>
              <p style="font-size:15px;line-height:1.7;color:#4B5563;margin:0 0 24px 0;">
                We hope you love the weave, vibrant colors, and authentic quality of your new saree. Wearing handloom is an appreciation of rich tradition and master artisanal craft!
              </p>

              <!-- Delivery Verification Card -->
              <div style="background-color:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:18px 20px;margin-bottom:28px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#065F46;margin-bottom:8px;">
                  Delivery Record
                </div>
                <div style="font-size:14px;color:#1F2937;line-height:1.6;">
                  <strong>Recipient:</strong> ${order.customerName}<br/>
                  <strong>Address:</strong> ${order.shippingAddress}, ${order.city}, ${order.state} - ${order.pinCode}<br/>
                  ${order.carrier ? `<strong>Delivered By:</strong> ${order.carrier}<br/>` : ''}
                  ${order.trackingNumber ? `<strong>Tracking AWB:</strong> ${order.trackingNumber}<br/>` : ''}
                  <strong>Total Value:</strong> ₹${order.total.toLocaleString('en-IN')}
                </div>
              </div>

              <!-- Share Review / Feedback Prompt -->
              <div style="background-color:#FAF5F0;border-radius:10px;padding:20px;text-align:center;margin-bottom:28px;">
                <h3 style="margin:0 0 8px 0;font-size:16px;color:#4A154B;font-family:Georgia,serif;">
                  How did we do?
                </h3>
                <p style="margin:0 0 16px 0;font-size:13px;color:#6B7280;line-height:1.5;">
                  Your review inspires our artisan weavers and helps other saree connoisseurs make the right choice.
                </p>
                <a href="${clientUrl}/dashboard" style="display:inline-block;background-color:#4A154B;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 30px;border-radius:24px;box-shadow:0 3px 10px rgba(74,21,75,0.25);">
                  Leave a Product Review &rarr;
                </a>
              </div>

              <div style="text-align:center;">
                <a href="${clientUrl}/products" style="font-size:13px;color:#059669;text-decoration:none;font-weight:600;">
                  Discover More Exquisite Weaves &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9F9FB;border-top:1px solid #EEEEEE;padding:24px 30px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;">
                Any issues with your parcel? We are here to assist with returns, exchanges, or questions via 
                <a href="https://wa.me/${this.WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}" style="color:#059669;font-weight:600;text-decoration:none;">WhatsApp Concierge</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                &copy; ${new Date().getFullYear()} ${this.STORE_NAME} • TechWave Retail360.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await this.send({ to: order.customerEmail, subject, html, category: 'order-delivered' });
  }

  /**
   * 4. Send Order Shipped Email upon status change to SHIPPED
   */
  static async sendOrderShippedEmail(order: OrderEmailData): Promise<any> {
    const clientUrl = this.getClientUrl();
    const customerName = order.customerName || 'Valued Customer';
    const carrier = order.carrier || 'Express Courier';
    const trackingNumber = order.trackingNumber || 'Tracking ID in progress';
    const subject = `Your Order #${order.orderNumber} Is On Its Way! 🚚 - Royal Saree & Fashion`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FDFBF7;padding:30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EBE3D5;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #1E3A8A 0%, #172554 100%);padding:36px 30px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">🚚</div>
              <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#93C5FD;text-transform:uppercase;margin-bottom:6px;">
                ORDER SHIPPED
              </div>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#FFFFFF;font-family:Georgia,serif;">
                Your Saree Has Been Dispatched!
              </h1>
              <div style="margin-top:12px;display:inline-block;background-color:#2563EB;color:#FFFFFF;font-size:13px;font-weight:700;padding:5px 16px;border-radius:20px;letter-spacing:0.5px;">
                Order #${order.orderNumber}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <p style="font-size:17px;font-weight:600;color:#1E3A8A;margin:0 0 12px 0;">
                Namaste ${customerName}, 🙏
              </p>
              <p style="font-size:15px;line-height:1.7;color:#4B5563;margin:0 0 24px 0;">
                Great news! Your package for <strong>Order #${order.orderNumber}</strong> has been handed over to our trusted courier partner and is on its way to your delivery destination.
              </p>

              <!-- Shipping Info Card -->
              <div style="background-color:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:20px;margin-bottom:28px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1E40AF;margin-bottom:10px;">
                  Dispatch &amp; Tracking Details
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#4B5563;">Courier Partner:</td>
                    <td align="right" style="padding:4px 0;font-size:14px;font-weight:700;color:#1F2937;">${carrier}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#4B5563;">Tracking AWB / No:</td>
                    <td align="right" style="padding:4px 0;font-size:14px;font-weight:700;color:#2563EB;">${trackingNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#4B5563;">Destination:</td>
                    <td align="right" style="padding:4px 0;font-size:14px;color:#1F2937;">${order.city}, ${order.state} (${order.pinCode})</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:14px;color:#4B5563;">Estimated Delivery:</td>
                    <td align="right" style="padding:4px 0;font-size:14px;font-weight:600;color:#059669;">2 - 4 Business Days</td>
                  </tr>
                </table>
              </div>

              <!-- Action Button -->
              <div style="text-align:center;margin:28px 0 16px 0;">
                <a href="${clientUrl}/track-order?orderId=${order.orderNumber}" style="display:inline-block;background-color:#1E3A8A;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:30px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(30,58,138,0.25);">
                  Track Shipment Live &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9F9FB;border-top:1px solid #EEEEEE;padding:24px 30px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;">
                Need help with shipment delivery? Contact us on 
                <a href="https://wa.me/${this.WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}" style="color:#059669;font-weight:600;text-decoration:none;">WhatsApp (${this.WHATSAPP_NUMBER})</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                &copy; ${new Date().getFullYear()} ${this.STORE_NAME} • TechWave Retail360.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await this.send({ to: order.customerEmail, subject, html, category: 'order-shipped' });
  }

  /**
   * 5. Send Email Verification Code OTP for Customer Registration
   */
  static async sendVerificationCodeEmail(params: { name: string; email: string; code: string }): Promise<void> {
    const customerName = params.name.trim();
    const subject = `Your Verification Code: ${params.code} - Royal Saree & Fashion`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FDFBF7;padding:30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#FFFFFF;border-radius:14px;border:1px solid #EBE3D5;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.04);">
          
          <tr style="background:#4A154B;text-align:center;">
            <td style="padding:28px 24px;">
              <h2 style="color:#FFFFFF;margin:0;font-size:22px;font-family:Georgia,serif;letter-spacing:0.5px;">
                Royal Saree &amp; Fashion
              </h2>
              <div style="font-size:11px;color:#E9D5FF;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">
                Email Verification
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 28px;">
              <p style="font-size:16px;color:#4A154B;font-weight:600;margin:0 0 12px 0;">
                Namaste ${customerName}, 🙏
              </p>
              <p style="font-size:14px;line-height:1.6;color:#4B5563;margin:0 0 20px 0;">
                Please use the 6-digit verification code below to verify your email address and activate your customer account:
              </p>

              <div style="background-color:#FAF5F0;border:1px dashed #D97706;border-radius:10px;padding:16px;text-align:center;margin:24px 0;">
                <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#D97706;font-family:monospace;">
                  ${params.code}
                </span>
              </div>

              <p style="font-size:12px;color:#6B7280;line-height:1.5;margin:0 0 16px 0;">
                ⏱️ This code is valid for <strong>15 minutes</strong>. For your security, never share this code with anyone.
              </p>
              <p style="font-size:12px;color:#9CA3AF;margin:0;">
                If you did not request this verification, please disregard this email.
              </p>
            </td>
          </tr>

          <tr style="background-color:#F9F9FB;border-top:1px solid #EEEEEE;text-align:center;">
            <td style="padding:16px 20px;font-size:11px;color:#9CA3AF;">
              &copy; ${new Date().getFullYear()} Royal Saree &amp; Fashion • TechWave Retail360.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await this.send({ to: params.email, subject, html, category: 'register-otp' });
  }

  /**
   * 6. Send Password Reset Code OTP
   */
  static async sendPasswordResetEmail(params: { email: string; code: string }): Promise<void> {
    const subject = `Your Password Reset Code: ${params.code} - Royal Saree & Fashion`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FDFBF7;padding:30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#FFFFFF;border-radius:14px;border:1px solid #EBE3D5;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.04);">
          
          <tr style="background:#4A154B;text-align:center;">
            <td style="padding:28px 24px;">
              <h2 style="color:#FFFFFF;margin:0;font-size:22px;font-family:Georgia,serif;letter-spacing:0.5px;">
                Royal Saree &amp; Fashion
              </h2>
              <div style="font-size:11px;color:#E9D5FF;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">
                Password Reset Request
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 28px;">
              <p style="font-size:16px;color:#4A154B;font-weight:600;margin:0 0 12px 0;">
                Namaste, 🙏
              </p>
              <p style="font-size:14px;line-height:1.6;color:#4B5563;margin:0 0 20px 0;">
                We received a request to reset your password. Use the 6-digit code below to set your new password:
              </p>

              <div style="background-color:#FAF5F0;border:1px dashed #D97706;border-radius:10px;padding:16px;text-align:center;margin:24px 0;">
                <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#D97706;font-family:monospace;">
                  ${params.code}
                </span>
              </div>

              <p style="font-size:12px;color:#6B7280;line-height:1.5;margin:0 0 16px 0;">
                ⏱️ This code is valid for <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email; your account remains secure.
              </p>
            </td>
          </tr>

          <tr style="background-color:#F9F9FB;border-top:1px solid #EEEEEE;text-align:center;">
            <td style="padding:16px 20px;font-size:11px;color:#9CA3AF;">
              &copy; ${new Date().getFullYear()} Royal Saree &amp; Fashion • TechWave Retail360.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await this.send({ to: params.email, subject, html, category: 'password-reset' });
  }

  /**
   * General order status change notification (Delivered, Shipped, Confirmed, Cancelled)
   */
  static async sendOrderStatusEmail(order: OrderEmailData, status: string): Promise<void> {
    if (status === 'DELIVERED') {
      await this.sendOrderDeliveredEmail(order);
    } else if (status === 'SHIPPED' || status === 'OUT_FOR_DELIVERY') {
      await this.sendOrderShippedEmail(order);
    } else if (status === 'CONFIRMED') {
      await this.sendOrderConfirmationEmail(order);
    }
  }

  private static getAdminEmail(): string {
    return process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'techwavesolutions.dev@gmail.com';
  }

  /**
   * 7. Send Admin Notification when a New Customer Registers
   */
  static async sendAdminNewCustomerAlert(customer: {
    name: string;
    email: string;
    phone?: string | null;
  }): Promise<any> {
    const adminEmail = this.getAdminEmail();
    const clientUrl = this.getClientUrl();
    const subject = `👤 [New Customer Alert] ${customer.name} registered on Royal Saree & Fashion`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FDFBF7;padding:30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#FFFFFF;border-radius:14px;border:1px solid #EBE3D5;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.04);">
          
          <tr style="background:#1E293B;text-align:center;">
            <td style="padding:26px 24px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#94A3B8;text-transform:uppercase;margin-bottom:4px;">
                Store Administration
              </div>
              <h2 style="color:#FFFFFF;margin:0;font-size:22px;font-family:Georgia,serif;">
                New Customer Account Created
              </h2>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 26px;">
              <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 20px 0;">
                A new customer has successfully registered and verified their account on <strong>${this.STORE_NAME}</strong>:
              </p>

              <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#64748B;">Customer Name:</td>
                    <td align="right" style="padding:6px 0;font-size:14px;font-weight:700;color:#0F172A;">${customer.name}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#64748B;">Email Address:</td>
                    <td align="right" style="padding:6px 0;font-size:14px;font-weight:600;color:#2563EB;">${customer.email}</td>
                  </tr>
                  ${
                    customer.phone
                      ? `<tr>
                    <td style="padding:6px 0;font-size:14px;color:#64748B;">Phone:</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:#0F172A;">${customer.phone}</td>
                  </tr>`
                      : ''
                  }
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#64748B;">Registration Time:</td>
                    <td align="right" style="padding:6px 0;font-size:13px;color:#64748B;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align:center;margin:24px 0 10px 0;">
                <a href="${clientUrl}/admin/customers" style="display:inline-block;background-color:#0F172A;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:24px;box-shadow:0 3px 10px rgba(15,23,42,0.2);">
                  View Customers in Admin Portal &rarr;
                </a>
              </div>
            </td>
          </tr>

          <tr style="background-color:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;">
            <td style="padding:16px 20px;font-size:11px;color:#94A3B8;">
              &copy; ${new Date().getFullYear()} ${this.STORE_NAME} Management • TechWave Retail360
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await this.send({ to: adminEmail, subject, html, category: 'admin-new-customer' });
  }

  /**
   * 8. Send Admin Notification when a New Order is Placed
   */
  static async sendAdminNewOrderAlert(order: OrderEmailData): Promise<any> {
    const adminEmail = this.getAdminEmail();
    const clientUrl = this.getClientUrl();
    const subject = `🛍️ [New Order Alert] #${order.orderNumber} - ₹${order.total.toLocaleString('en-IN')} by ${order.customerName}`;

    const itemsHtml = order.items
      .map(
        (it) => `
        <tr style="border-bottom:1px solid #E2E8F0;">
          <td style="padding:10px 6px;font-size:13px;color:#0F172A;">
            <strong>${it.productName}</strong>
            ${it.productSku ? `<br/><span style="font-size:11px;color:#64748B;">SKU: ${it.productSku}</span>` : ''}
          </td>
          <td align="center" style="padding:10px 6px;font-size:13px;color:#334155;">
            ${it.quantity}
          </td>
          <td align="right" style="padding:10px 6px;font-size:13px;color:#0F172A;font-weight:600;">
            ₹${it.total.toLocaleString('en-IN')}
          </td>
        </tr>
      `
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FDFBF7;padding:30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:14px;border:1px solid #EBE3D5;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.04);">
          
          <tr style="background:#4A154B;text-align:center;">
            <td style="padding:28px 24px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#F6C56F;text-transform:uppercase;margin-bottom:4px;">
                NEW ORDER RECEIVED
              </div>
              <h2 style="color:#FFFFFF;margin:0;font-size:24px;font-family:Georgia,serif;">
                Order #${order.orderNumber}
              </h2>
              <div style="margin-top:8px;font-size:14px;color:#E9D5FF;">
                Grand Total: <strong style="color:#FFFFFF;font-size:16px;">₹${order.total.toLocaleString('en-IN')}</strong>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 26px;">
              <p style="font-size:15px;color:#334155;margin:0 0 18px 0;">
                A new order has just been placed and requires fulfillment:
              </p>

              <!-- Customer & Delivery Summary -->
              <div style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#475569;margin-bottom:10px;">
                  Customer &amp; Shipping Details
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#64748B;">Customer:</td>
                    <td align="right" style="padding:4px 0;font-size:13px;font-weight:600;color:#0F172A;">${order.customerName}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#64748B;">Email:</td>
                    <td align="right" style="padding:4px 0;font-size:13px;color:#2563EB;">${order.customerEmail}</td>
                  </tr>
                  ${
                    order.customerPhone
                      ? `<tr>
                    <td style="padding:4px 0;font-size:13px;color:#64748B;">Phone:</td>
                    <td align="right" style="padding:4px 0;font-size:13px;color:#0F172A;">${order.customerPhone}</td>
                  </tr>`
                      : ''
                  }
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#64748B;">Delivery Address:</td>
                    <td align="right" style="padding:4px 0;font-size:13px;color:#0F172A;">${order.shippingAddress}, ${order.city}, ${order.state} - ${order.pinCode}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;font-size:13px;color:#64748B;">Payment:</td>
                    <td align="right" style="padding:4px 0;font-size:13px;font-weight:600;color:#059669;">${order.paymentMethod || 'Online'} (${order.paymentStatus || 'PAID'})</td>
                  </tr>
                </table>
              </div>

              <!-- Ordered Items -->
              <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#475569;margin-bottom:8px;">
                Items to Pack
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
                <thead>
                  <tr style="border-bottom:1px solid #CBD5E1;color:#64748B;font-size:11px;text-transform:uppercase;">
                    <th align="left" style="padding:6px;">Item</th>
                    <th align="center" style="padding:6px;">Qty</th>
                    <th align="right" style="padding:6px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- CTA -->
              <div style="text-align:center;margin:24px 0 10px 0;">
                <a href="${clientUrl}/admin/orders" style="display:inline-block;background-color:#4A154B;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:24px;box-shadow:0 3px 10px rgba(74,21,75,0.25);">
                  Open Order in Admin Dashboard &rarr;
                </a>
              </div>
            </td>
          </tr>

          <tr style="background-color:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;">
            <td style="padding:16px 20px;font-size:11px;color:#94A3B8;">
              &copy; ${new Date().getFullYear()} ${this.STORE_NAME} • TechWave Retail360 Admin System
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return await this.send({ to: adminEmail, subject, html, category: 'admin-new-order' });
  }
}
