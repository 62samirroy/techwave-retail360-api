export function formatPrice(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export function generateOrderNumber(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `TW-ORD-${randomNum}`;
}

export function buildWhatsAppLink(message: string, customPhone?: string): string {
  const phone = (customPhone || '+919641145871').replace(/[^0-9]/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}
