import { Timestamp } from 'firebase/firestore';

export const LIMITS = {
  id: 128,
  storeName: 80,
  whatsapp: 20,
  pixKey: 100,
  address: 160,
  operatingHours: 60,
  customerNotice: 280,
  template: 500,
  name: 80,
  supplier: 80,
  neighborhood: 80,
  description: 200,
  notes: 240,
  expenseDescription: 120,
  txDescription: 160,
  whatsappMessage: 1000,
  maxOrderItems: 25,
} as const;

export type ProductCategory = 'espetinho' | 'bebida' | 'acompanhamento' | 'combo';
export type ImageKey = 'espetinho_carne' | 'linguica_coracao' | 'bebidas_geladas' | 'brasa_geral';
export type InsumoUnit = 'un' | 'kg' | 'L' | 'pct';
export type DeliveryType = 'balcao' | 'retirada' | 'entrega';
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'fiado';
export type PaymentStatus = 'pago' | 'fiado_pendente' | 'fiado_parcial';
export type OrderStatus = 'novo' | 'confirmado' | 'na_brasa' | 'pronto' | 'entregue' | 'cancelado';
export type DayType = 'domingo' | 'feriado';
export type ExpenseCategory = 'carvao' | 'insumos' | 'gelo' | 'gas' | 'outros';
export type WhatsappLogType = 'confirmacao_pedido' | 'pedido_pronto' | 'cobranca_fiado' | 'comunicado';

export interface StoreSettings {
  ownerId: string;
  storeName: string;
  ownerWhatsapp: string;
  pixKey: string;
  address: string;
  operatingHours: string;
  customerNotice: string;
  confirmTemplate: string;
  readyTemplate: string;
  fiadoTemplate: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CustomHoliday {
  id: string;
  ownerId: string;
  date: string; // YYYY-MM-DD
  name: string;
  createdAt?: Timestamp;
}

export interface Insumo {
  id: string;
  ownerId: string;
  name: string;
  unit: InsumoUnit;
  currentStock: number;
  minStock: number;
  unitCost: number;
  supplier: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StockComponent {
  insumoId: string;
  qtyPerUnit: number;
}

export interface Product {
  id: string;
  ownerId: string;
  name: string;
  category: ProductCategory;
  price: number;
  costPrice: number;
  insumoId: string;
  insumoQtyPerUnit: number;
  extraInsumos?: StockComponent[];
  active: boolean;
  imageKey: ImageKey;
  description: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Customer {
  id: string;
  ownerId: string;
  name: string;
  whatsapp: string;
  neighborhood: string;
  notes: string;
  fiadoBalance: number;
  totalSpent: number;
  ordersCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OrderItem {
  productId: string;
  productName: string;
  category: ProductCategory;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
  insumoId: string;
  insumoQtyPerUnit: number;
  extraInsumos?: StockComponent[];
}

export interface Order {
  id: string;
  ownerId: string;
  orderNumber: number;
  saleDate: string; // YYYY-MM-DD
  dayType: DayType;
  holidayName: string;
  customerId: string;
  customerName: string;
  customerWhatsapp: string;
  deliveryType: DeliveryType;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  estimatedCost: number;
  estimatedProfit: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  orderStatus: OrderStatus;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FiadoTransaction {
  id: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  orderId: string;
  type: 'debito' | 'pagamento';
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  createdAt?: Timestamp;
}

export interface DailyExpense {
  id: string;
  ownerId: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: ExpenseCategory;
  amount: number;
  createdAt?: Timestamp;
}

export interface WhatsappLog {
  id: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  whatsapp: string;
  orderId: string;
  type: WhatsappLogType;
  message: string;
  createdAt?: Timestamp;
}

export type ActiveTab =
  | 'painel'
  | 'pedidos'
  | 'produtos'
  | 'insumos'
  | 'clientes'
  | 'relatorios'
  | 'vitrine'
  | 'configuracoes';

export interface WhatsappDispatchPrompt {
  customerName: string;
  customerId: string;
  whatsapp: string;
  orderId: string;
  type: WhatsappLogType;
  message: string;
  title: string;
}
