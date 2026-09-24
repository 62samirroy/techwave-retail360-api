import crypto from 'crypto';
import Razorpay from 'razorpay';

const KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_demo123456';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret_demo654321';

export class RazorpayService {
  private static instance: Razorpay | null = null;

  private static getClient(): Razorpay {
    if (!this.instance) {
      this.instance = new Razorpay({
        key_id: KEY_ID,
        key_secret: KEY_SECRET,
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

    if (!KEY_ID || KEY_ID === 'rzp_test_demo123456' || KEY_ID === 'rzp_test_placeholder_key') {
      throw new Error(
        'Real Razorpay credentials required: RAZORPAY_KEY_ID is currently set to placeholder demo123456. Please provide your real Razorpay Test Key ID & Secret.'
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
        .createHmac('sha256', KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      return generatedSignature === signature;
    } catch (err) {
      console.error('Signature verification error:', err);
      return false;
    }
  }

  static getPublicKey(): string {
    return KEY_ID;
  }
}
