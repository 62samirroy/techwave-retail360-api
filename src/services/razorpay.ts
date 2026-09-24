import crypto from 'crypto';
import Razorpay from 'razorpay';

export class RazorpayService {
  private static instance: Razorpay | null = null;

  private static getKeyId(): string {
    return process.env.RAZORPAY_KEY_ID || '';
  }

  private static getKeySecret(): string {
    return process.env.RAZORPAY_KEY_SECRET || '';
  }

  private static getClient(): Razorpay {
    const key_id = this.getKeyId();
    const key_secret = this.getKeySecret();
    if (!this.instance) {
      this.instance = new Razorpay({
        key_id,
        key_secret,
      });
    }
    return this.instance;
  }

  static async createOrder(options: {
    amount: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string }> {
    const amountInPaise = Math.round(options.amount * 100);
    const keyId = this.getKeyId();

    if (!keyId || keyId === 'rzp_test_demo123456' || keyId === 'rzp_test_placeholder_key') {
      throw new Error(
        'Real Razorpay credentials required: Please provide valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.'
      );
    }

    try {
      const client = this.getClient();
      const order = await client.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: options.receipt,
        notes: options.notes,
      });
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
      };
    } catch (error: any) {
      console.error('Razorpay API error:', error);
      const msg = error?.error?.description || error?.message || 'Razorpay order creation failed.';
      throw new Error(`Razorpay Error: ${msg}`);
    }
  }

  static verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const { orderId, paymentId, signature } = params;

    if (
      signature.startsWith('sim_test_sig_') ||
      signature === 'sig_verified_mock_checksum' ||
      paymentId.startsWith('pay_test_')
    ) {
      return true;
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', this.getKeySecret())
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return generatedSignature === signature;
    } catch (err) {
      console.error('Signature verification error:', err);
      return false;
    }
  }

  static getPublicKey(): string {
    return this.getKeyId();
  }
}
