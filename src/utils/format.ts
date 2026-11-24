import { OrderItem, StoreSettings } from '../types';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(value: number): string {
  return brlFormatter.format(Number.isFinite(value) ? value : 0);
}

export function normalizeWhatsappDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export function formatWhatsappDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = normalizeWhatsappDigits(phone);
  const encoded = encodeURIComponent(message);
  if (!cleanPhone) {
    return `https://wa.me/?text=${encoded}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

export function formatOrderItemsSummary(items: OrderItem[]): string {
  return items
    .map((item) => `${item.quantity}x ${item.productName} (${formatBRL(item.subtotal)})`)
    .join('\n');
}

export function renderOrderTemplate(
  template: string,
  params: {
    customerName: string;
    orderNumber: number;
    items: OrderItem[];
    total: number;
    saleDateBR: string;
    paymentLabel: string;
    settings: Pick<StoreSettings, 'storeName' | 'pixKey' | 'address'>;
  }
): string {
  return template
    .replace(/\{cliente\}/g, params.customerName)
    .replace(/\{pedido\}/g, String(params.orderNumber))
    .replace(/\{itens\}/g, formatOrderItemsSummary(params.items))
    .replace(/\{total\}/g, formatBRL(params.total))
    .replace(/\{data\}/g, params.saleDateBR)
    .replace(/\{pagamento\}/g, params.paymentLabel)
    .replace(/\{loja\}/g, params.settings.storeName)
    .replace(/\{pix\}/g, params.settings.pixKey)
    .replace(/\{endereco\}/g, params.settings.address);
}

export function renderFiadoTemplate(
  template: string,
  params: {
    customerName: string;
    balance: number;
    settings: Pick<StoreSettings, 'storeName' | 'pixKey'>;
  }
): string {
  return template
    .replace(/\{cliente\}/g, params.customerName)
    .replace(/\{saldo\}/g, formatBRL(params.balance))
    .replace(/\{loja\}/g, params.settings.storeName)
    .replace(/\{pix\}/g, params.settings.pixKey);
}

export function sanitizeString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}
