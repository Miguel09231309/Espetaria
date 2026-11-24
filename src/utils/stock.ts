import { Insumo, Order, OrderItem, Product, StockComponent } from '../types';

/**
 * Aggregates primary insumoId + any extraInsumos on a product or order item into a deduplicated list.
 */
export function getProductStockLinks(
  source: Pick<Product, 'insumoId' | 'insumoQtyPerUnit' | 'extraInsumos'>
): StockComponent[] {
  const map = new Map<string, number>();

  if (source.insumoId && source.insumoQtyPerUnit > 0) {
    map.set(source.insumoId, (map.get(source.insumoId) || 0) + source.insumoQtyPerUnit);
  }

  if (Array.isArray(source.extraInsumos)) {
    for (const comp of source.extraInsumos) {
      if (comp && comp.insumoId && comp.qtyPerUnit > 0) {
        map.set(comp.insumoId, (map.get(comp.insumoId) || 0) + comp.qtyPerUnit);
      }
    }
  }

  return Array.from(map.entries()).map(([insumoId, qtyPerUnit]) => ({
    insumoId,
    qtyPerUnit: Number(qtyPerUnit.toFixed(2)),
  }));
}

/**
 * Resolves stock components for an order item, falling back to the live Product catalog if needed.
 */
export function getItemStockLinks(
  item: Pick<OrderItem, 'productId' | 'insumoId' | 'insumoQtyPerUnit' | 'extraInsumos'>,
  products?: Product[]
): StockComponent[] {
  const direct = getProductStockLinks(item);
  if (direct.length > 0) {
    return direct;
  }

  if (products && item.productId) {
    const matched = products.find((p) => p.id === item.productId);
    if (matched) {
      return getProductStockLinks(matched);
    }
  }

  return [];
}

/**
 * Computes total insumo consumption currently held inside a cart or bag.
 */
export function computeCartInsumoUsage(
  cartItems: OrderItem[],
  products?: Product[]
): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const item of cartItems) {
    const links = getItemStockLinks(item, products);
    for (const link of links) {
      usage[link.insumoId] = Number(
        ((usage[link.insumoId] || 0) + link.qtyPerUnit * item.quantity).toFixed(2)
      );
    }
  }
  return usage;
}

/**
 * Calculates how many units of a product can still be sold given current stock and cart reservations.
 * Returns null only if the product has no linked stock components at all.
 */
export function computeProductAvailableUnits(
  product: Product,
  insumos: Insumo[],
  cartItems: OrderItem[] = [],
  allProducts?: Product[]
): number | null {
  const links = getProductStockLinks(product);
  if (links.length === 0) return null;

  const cartUsage = computeCartInsumoUsage(cartItems, allProducts);
  let minAvailable = Infinity;

  for (const link of links) {
    const insumo = insumos.find((i) => i.id === link.insumoId);
    if (!insumo) continue;
    const reserved = cartUsage[link.insumoId] || 0;
    const remainingStock = Math.max(0, insumo.currentStock - reserved);
    const possible = Math.floor(remainingStock / link.qtyPerUnit);
    if (possible < minAvailable) {
      minAvailable = possible;
    }
  }

  return minAvailable === Infinity ? null : Math.max(0, minAvailable);
}

/**
 * Calculates total units sold per productId (across non-cancelled orders).
 */
export function computeSoldUnitsByProduct(orders: Order[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const order of orders) {
    if (order.orderStatus === 'cancelado') continue;
    for (const item of order.items) {
      if (item.productId) {
        totals[item.productId] = (totals[item.productId] || 0) + item.quantity;
      }
    }
  }
  return totals;
}

/**
 * Calculates total units deducted per insumoId (across non-cancelled orders).
 */
export function computeSoldUnitsByInsumo(
  orders: Order[],
  products: Product[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const order of orders) {
    if (order.orderStatus === 'cancelado') continue;
    for (const item of order.items) {
      const links = getItemStockLinks(item, products);
      for (const link of links) {
        totals[link.insumoId] = Number(
          ((totals[link.insumoId] || 0) + link.qtyPerUnit * item.quantity).toFixed(2)
        );
      }
    }
  }
  return totals;
}
