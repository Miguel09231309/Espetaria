import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  updateDoc,
  addDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  CustomHoliday,
  Customer,
  DailyExpense,
  Insumo,
  InsumoUnit,
  LIMITS,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  StockComponent,
  StoreSettings,
  WhatsappLog,
  WhatsappLogType,
} from '../types';
import { sanitizeString } from '../utils/format';
import {
  CATALOG_PRODUCTS_SEED,
  DEFAULT_STORE_SETTINGS,
  getRecentSundays,
  INSUMOS_CATALOG_SEED,
} from '../data/seedData';
import { checkOperatingDay } from '../utils/holidays';
import { getItemStockLinks } from '../utils/stock';

function normalizeKey(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sanitizeOrderItem(item: OrderItem, products?: Product[]): OrderItem {
  const matchedProd = products?.find((p) => p.id === item.productId);
  const insumoId = item.insumoId || matchedProd?.insumoId || '';
  const insumoQtyPerUnit =
    item.insumoQtyPerUnit > 0
      ? item.insumoQtyPerUnit
      : matchedProd?.insumoQtyPerUnit || 0;
  const rawExtras =
    item.extraInsumos && item.extraInsumos.length > 0
      ? item.extraInsumos
      : matchedProd?.extraInsumos || [];

  const cleanExtras = rawExtras
    .filter((c) => c && c.insumoId && c.qtyPerUnit > 0)
    .map((c) => ({ insumoId: c.insumoId, qtyPerUnit: Number(c.qtyPerUnit) }));

  const cleaned: OrderItem = {
    productId: item.productId,
    productName: sanitizeString(item.productName, LIMITS.name),
    category: item.category,
    quantity: Math.max(1, Number(item.quantity) || 1),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    unitCost: Math.max(0, Number(item.unitCost) || 0),
    subtotal: Math.max(0, Number(item.subtotal) || 0),
    insumoId,
    insumoQtyPerUnit,
  };

  if (cleanExtras.length > 0) {
    cleaned.extraInsumos = cleanExtras;
  }

  return cleaned;
}

export function subscribeOwnerCollection<T>(
  collectionName: string,
  ownerId: string,
  onData: (items: T[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, collectionName), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as T[];
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        } else {
          throw wrapped;
        }
      }
    }
  );
}

export function subscribeStoreSettings(
  ownerId: string,
  onData: (settings: StoreSettings | null) => void,
  onError?: (error: Error) => void
) {
  const ref = doc(db, 'storeSettings', ownerId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as StoreSettings);
      } else {
        onData(null);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `storeSettings/${ownerId}`);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        } else {
          throw wrapped;
        }
      }
    }
  );
}

export async function ensureOwnerSeeded(ownerId: string): Promise<boolean> {
  const settingsRef = doc(db, 'storeSettings', ownerId);
  let snap;
  try {
    snap = await getDoc(settingsRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `storeSettings/${ownerId}`);
  }

  if (snap.exists()) {
    return false;
  }

  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.set(settingsRef, {
    ownerId,
    ...DEFAULT_STORE_SETTINGS,
    createdAt: now,
    updatedAt: now,
  });

  // Create full insumos catalog
  const insumoRefsByKey: Record<string, ReturnType<typeof doc>> = {};
  for (const ins of INSUMOS_CATALOG_SEED) {
    const ref = doc(collection(db, 'insumos'));
    insumoRefsByKey[ins.key] = ref;
    batch.set(ref, {
      ownerId,
      name: ins.name,
      unit: ins.unit,
      currentStock: ins.currentStock,
      minStock: ins.minStock,
      unitCost: ins.unitCost,
      supplier: ins.supplier,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create full products catalog linked 100% to insumos
  const prodRefsByKey: Record<string, ReturnType<typeof doc>> = {};
  for (const prod of CATALOG_PRODUCTS_SEED) {
    const ref = doc(collection(db, 'products'));
    prodRefsByKey[prod.key] = ref;

    const primaryInsumoId = insumoRefsByKey[prod.insumoKey]?.id || '';
    const extraInsumos: StockComponent[] = (prod.extraInsumos || [])
      .map((ex) => ({
        insumoId: insumoRefsByKey[ex.insumoKey]?.id || '',
        qtyPerUnit: ex.qtyPerUnit,
      }))
      .filter((x) => x.insumoId && x.qtyPerUnit > 0);

    batch.set(ref, {
      ownerId,
      name: prod.name,
      category: prod.category,
      price: prod.price,
      costPrice: prod.costPrice,
      insumoId: primaryInsumoId,
      insumoQtyPerUnit: prod.insumoQtyPerUnit,
      ...(extraInsumos.length > 0 ? { extraInsumos } : {}),
      active: true,
      imageKey: prod.imageKey,
      description: prod.description,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Customers
  const cust1Ref = doc(collection(db, 'customers'));
  const cust2Ref = doc(collection(db, 'customers'));
  const cust3Ref = doc(collection(db, 'customers'));
  const cust4Ref = doc(collection(db, 'customers'));

  batch.set(cust1Ref, {
    ownerId,
    name: 'Carlos Eduardo Silva',
    whatsapp: '11991234567',
    neighborhood: 'Vila Nova',
    notes: 'Prefere alcatra ao ponto e Coca zero.',
    fiadoBalance: 42.0,
    totalSpent: 154.0,
    ordersCount: 4,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(cust2Ref, {
    ownerId,
    name: 'Mariana Costa',
    whatsapp: '11987651234',
    neighborhood: 'Centro',
    notes: 'Sempre busca às 12h30 aos domingos.',
    fiadoBalance: 0,
    totalSpent: 98.0,
    ordersCount: 3,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(cust3Ref, {
    ownerId,
    name: 'João Pedro Almeida',
    whatsapp: '11994443322',
    neighborhood: 'Jardim das Flores',
    notes: 'Paga no Pix toda segunda-feira.',
    fiadoBalance: 28.0,
    totalSpent: 112.0,
    ordersCount: 3,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(cust4Ref, {
    ownerId,
    name: 'Fernanda Oliveira',
    whatsapp: '11982221100',
    neighborhood: 'Parque Industrial',
    notes: 'Gosta de queijo coalho bem passado.',
    fiadoBalance: 0,
    totalSpent: 64.0,
    ordersCount: 2,
    createdAt: now,
    updatedAt: now,
  });

  // Sample Sunday Orders across last 3 Sundays
  const sundays = getRecentSundays(3);
  const [sun0, sun1, sun2] = sundays;

  const idOfProd = (k: string) => prodRefsByKey[k]?.id || '';
  const idOfIns = (k: string) => insumoRefsByKey[k]?.id || '';

  const sampleOrders = [
    {
      orderNumber: 101,
      saleDate: sun0,
      customerId: cust2Ref.id,
      customerName: 'Mariana Costa',
      customerWhatsapp: '11987651234',
      deliveryType: 'retirada',
      items: [
        { productId: idOfProd('prod_alcatra'), productName: 'Espetinho de Alcatra', category: 'espetinho', quantity: 3, unitPrice: 12, unitCost: 5.2, subtotal: 36, insumoId: idOfIns('alcatra'), insumoQtyPerUnit: 1 },
        { productId: idOfProd('prod_coca_lata'), productName: 'Coca-Cola Lata 350ml', category: 'bebida', quantity: 2, unitPrice: 6, unitCost: 2.9, subtotal: 12, insumoId: idOfIns('coca_lata'), insumoQtyPerUnit: 1 },
      ],
      subtotal: 48,
      discount: 0,
      total: 48,
      estimatedCost: 21.4,
      estimatedProfit: 26.6,
      paymentMethod: 'pix',
      paymentStatus: 'pago',
      paidAmount: 48,
      orderStatus: 'pronto',
      notes: 'Sem farofa em 1 espetinho',
    },
    {
      orderNumber: 102,
      saleDate: sun0,
      customerId: cust1Ref.id,
      customerName: 'Carlos Eduardo Silva',
      customerWhatsapp: '11991234567',
      deliveryType: 'balcao',
      items: [
        { productId: idOfProd('prod_alcatra'), productName: 'Espetinho de Alcatra', category: 'espetinho', quantity: 2, unitPrice: 12, unitCost: 5.2, subtotal: 24, insumoId: idOfIns('alcatra'), insumoQtyPerUnit: 1 },
        { productId: idOfProd('prod_coalho'), productName: 'Queijo Coalho na Brasa', category: 'espetinho', quantity: 1, unitPrice: 10, unitCost: 4.2, subtotal: 10, insumoId: idOfIns('coalho'), insumoQtyPerUnit: 1 },
        { productId: idOfProd('prod_agua'), productName: 'Água Mineral 500ml', category: 'bebida', quantity: 2, unitPrice: 4, unitCost: 1.2, subtotal: 8, insumoId: idOfIns('agua_sem_gas'), insumoQtyPerUnit: 1 },
      ],
      subtotal: 42,
      discount: 0,
      total: 42,
      estimatedCost: 17.0,
      estimatedProfit: 25.0,
      paymentMethod: 'fiado',
      paymentStatus: 'fiado_pendente',
      paidAmount: 0,
      orderStatus: 'entregue',
      notes: 'Anotar na caderneta para segunda',
    },
    {
      orderNumber: 103,
      saleDate: sun0,
      customerId: cust4Ref.id,
      customerName: 'Fernanda Oliveira',
      customerWhatsapp: '11982221100',
      deliveryType: 'entrega',
      items: [
        {
          productId: idOfProd('prod_combo_domingo'),
          productName: 'Combo Domingo (2 Espetos + Refri)',
          category: 'combo',
          quantity: 2,
          unitPrice: 28,
          unitCost: 13.3,
          subtotal: 56,
          insumoId: idOfIns('alcatra'),
          insumoQtyPerUnit: 2,
          extraInsumos: [{ insumoId: idOfIns('coca_lata'), qtyPerUnit: 1 }],
        },
        { productId: idOfProd('prod_coracao'), productName: 'Espetinho de Coração', category: 'espetinho', quantity: 2, unitPrice: 11, unitCost: 4.5, subtotal: 22, insumoId: idOfIns('coracao'), insumoQtyPerUnit: 1 },
      ],
      subtotal: 78,
      discount: 2,
      total: 76,
      estimatedCost: 35.6,
      estimatedProfit: 40.4,
      paymentMethod: 'dinheiro',
      paymentStatus: 'pago',
      paidAmount: 76,
      orderStatus: 'na_brasa',
      notes: 'Levar troco para R$ 100',
    },
    {
      orderNumber: 94,
      saleDate: sun1,
      customerId: cust3Ref.id,
      customerName: 'João Pedro Almeida',
      customerWhatsapp: '11994443322',
      deliveryType: 'balcao',
      items: [
        { productId: idOfProd('prod_linguica'), productName: 'Espetinho de Linguiça Toscana', category: 'espetinho', quantity: 2, unitPrice: 10, unitCost: 4.0, subtotal: 20, insumoId: idOfIns('linguica'), insumoQtyPerUnit: 1 },
        { productId: idOfProd('prod_agua'), productName: 'Água Mineral 500ml', category: 'bebida', quantity: 2, unitPrice: 4, unitCost: 1.2, subtotal: 8, insumoId: idOfIns('agua_sem_gas'), insumoQtyPerUnit: 1 },
      ],
      subtotal: 28,
      discount: 0,
      total: 28,
      estimatedCost: 10.4,
      estimatedProfit: 17.6,
      paymentMethod: 'fiado',
      paymentStatus: 'fiado_pendente',
      paidAmount: 0,
      orderStatus: 'entregue',
      notes: 'Fiado semanal',
    },
    {
      orderNumber: 95,
      saleDate: sun1,
      customerId: '',
      customerName: 'Cliente Balcão',
      customerWhatsapp: '',
      deliveryType: 'balcao',
      items: [
        { productId: idOfProd('prod_alcatra'), productName: 'Espetinho de Alcatra', category: 'espetinho', quantity: 10, unitPrice: 12, unitCost: 5.2, subtotal: 120, insumoId: idOfIns('alcatra'), insumoQtyPerUnit: 1 },
        { productId: idOfProd('prod_frango'), productName: 'Espetinho de Frango', category: 'espetinho', quantity: 8, unitPrice: 10, unitCost: 3.8, subtotal: 80, insumoId: idOfIns('frango'), insumoQtyPerUnit: 1 },
        { productId: idOfProd('prod_coca_lata'), productName: 'Coca-Cola Lata 350ml', category: 'bebida', quantity: 9, unitPrice: 6, unitCost: 2.9, subtotal: 54, insumoId: idOfIns('coca_lata'), insumoQtyPerUnit: 1 },
      ],
      subtotal: 254,
      discount: 0,
      total: 254,
      estimatedCost: 108.5,
      estimatedProfit: 145.5,
      paymentMethod: 'pix',
      paymentStatus: 'pago',
      paidAmount: 254,
      orderStatus: 'entregue',
      notes: 'Movimento de domingo',
    },
    {
      orderNumber: 81,
      saleDate: sun2,
      customerId: '',
      customerName: 'Movimento Geral Domingo',
      customerWhatsapp: '',
      deliveryType: 'balcao',
      items: [
        { productId: idOfProd('prod_alcatra'), productName: 'Espetinho de Alcatra', category: 'espetinho', quantity: 14, unitPrice: 12, unitCost: 5.2, subtotal: 168, insumoId: idOfIns('alcatra'), insumoQtyPerUnit: 1 },
        { productId: idOfProd('prod_guarana_lata'), productName: 'Guaraná Antarctica Lata', category: 'bebida', quantity: 10, unitPrice: 6, unitCost: 2.7, subtotal: 60, insumoId: idOfIns('guarana_lata'), insumoQtyPerUnit: 1 },
      ],
      subtotal: 228,
      discount: 0,
      total: 228,
      estimatedCost: 99.8,
      estimatedProfit: 128.2,
      paymentMethod: 'cartao',
      paymentStatus: 'pago',
      paidAmount: 228,
      orderStatus: 'entregue',
      notes: '',
    },
  ];

  const order102Ref = doc(collection(db, 'orders'));
  const order94Ref = doc(collection(db, 'orders'));

  sampleOrders.forEach((ord, idx) => {
    const oRef = idx === 1 ? order102Ref : idx === 3 ? order94Ref : doc(collection(db, 'orders'));
    const opInfo = checkOperatingDay(ord.saleDate, []);
    batch.set(oRef, {
      ownerId,
      orderNumber: ord.orderNumber,
      saleDate: ord.saleDate,
      dayType: opInfo.dayType ?? 'domingo',
      holidayName: opInfo.holidayName,
      customerId: ord.customerId,
      customerName: ord.customerName,
      customerWhatsapp: ord.customerWhatsapp,
      deliveryType: ord.deliveryType,
      items: ord.items,
      subtotal: ord.subtotal,
      discount: ord.discount,
      total: ord.total,
      estimatedCost: ord.estimatedCost,
      estimatedProfit: ord.estimatedProfit,
      paymentMethod: ord.paymentMethod,
      paymentStatus: ord.paymentStatus,
      paidAmount: ord.paidAmount,
      orderStatus: ord.orderStatus,
      notes: ord.notes,
      createdAt: now,
      updatedAt: now,
    });
  });

  // Fiado transactions matching open balances
  batch.set(doc(collection(db, 'fiadoTransactions')), {
    ownerId,
    customerId: cust1Ref.id,
    customerName: 'Carlos Eduardo Silva',
    orderId: order102Ref.id,
    type: 'debito',
    amount: 42.0,
    description: 'Pedido #102 — 2x Alcatra, 1x Coalho, 2x Água',
    paymentMethod: 'fiado',
    date: sun0,
    createdAt: now,
  });

  batch.set(doc(collection(db, 'fiadoTransactions')), {
    ownerId,
    customerId: cust3Ref.id,
    customerName: 'João Pedro Almeida',
    orderId: order94Ref.id,
    type: 'debito',
    amount: 28.0,
    description: 'Pedido #94 — 2x Linguiça, 2x Água',
    paymentMethod: 'fiado',
    date: sun1,
    createdAt: now,
  });

  // Daily expenses
  batch.set(doc(collection(db, 'dailyExpenses')), {
    ownerId,
    date: sun0,
    description: '2 sacos de carvão + 1 saco de gelo',
    category: 'carvao',
    amount: 44.0,
    createdAt: now,
  });
  batch.set(doc(collection(db, 'dailyExpenses')), {
    ownerId,
    date: sun1,
    description: 'Carvão 5kg + guardanapos e farofa',
    category: 'carvao',
    amount: 38.0,
    createdAt: now,
  });
  batch.set(doc(collection(db, 'dailyExpenses')), {
    ownerId,
    date: sun2,
    description: 'Carvão + gelo para bebidas',
    category: 'gelo',
    amount: 32.0,
    createdAt: now,
  });

  try {
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedOwnerWorkspace');
  }
}

/**
 * Ensures all standard products & insumos exist for already-provisioned workspaces,
 * repairs missing/shared stock links (e.g., Guaraná vs Coca, Combo Domingo extraInsumos),
 * and auto-creates & links insumos for any custom unlinked product.
 */
export async function syncCompleteCatalogAndStockLinks(
  ownerId: string
): Promise<{ addedProducts: number; addedInsumos: number; linkedProducts: number }> {
  let insumosSnap;
  let productsSnap;

  try {
    [insumosSnap, productsSnap] = await Promise.all([
      getDocs(query(collection(db, 'insumos'), where('ownerId', '==', ownerId))),
      getDocs(query(collection(db, 'products'), where('ownerId', '==', ownerId))),
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'syncCompleteCatalogAndStockLinks');
  }

  const existingInsumos: Insumo[] = insumosSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Insumo, 'id'>),
  }));
  const existingProducts: Product[] = productsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Product, 'id'>),
  }));

  const insumoByNormName = new Map<string, Insumo>();
  for (const ins of existingInsumos) {
    insumoByNormName.set(normalizeKey(ins.name), ins);
  }

  const productByNormName = new Map<string, Product>();
  for (const prod of existingProducts) {
    productByNormName.set(normalizeKey(prod.name), prod);
  }

  const batch = writeBatch(db);
  const now = serverTimestamp();
  let opsCount = 0;
  let addedInsumos = 0;
  let addedProducts = 0;
  let linkedProducts = 0;

  // 1. Ensure all catalog insumos exist and map seed.key -> insumoId
  const insumoIdByKey: Record<string, string> = {};
  for (const seed of INSUMOS_CATALOG_SEED) {
    const candidates = [seed.name, ...(seed.aliases || [])];
    let matched: Insumo | undefined;
    for (const c of candidates) {
      matched = insumoByNormName.get(normalizeKey(c));
      if (matched) break;
    }

    if (matched) {
      insumoIdByKey[seed.key] = matched.id;
    } else {
      const ref = doc(collection(db, 'insumos'));
      insumoIdByKey[seed.key] = ref.id;
      batch.set(ref, {
        ownerId,
        name: seed.name,
        unit: seed.unit,
        currentStock: seed.currentStock,
        minStock: seed.minStock,
        unitCost: seed.unitCost,
        supplier: seed.supplier,
        createdAt: now,
        updatedAt: now,
      });
      insumoByNormName.set(normalizeKey(seed.name), {
        id: ref.id,
        ownerId,
        name: seed.name,
        unit: seed.unit,
        currentStock: seed.currentStock,
        minStock: seed.minStock,
        unitCost: seed.unitCost,
        supplier: seed.supplier,
      });
      opsCount++;
      addedInsumos++;
    }
  }

  // 2. Ensure all catalog products exist and have complete stock links
  const handledProductIds = new Set<string>();
  for (const seed of CATALOG_PRODUCTS_SEED) {
    const candidates = [seed.name, ...(seed.aliases || [])];
    let matched: Product | undefined;
    for (const c of candidates) {
      matched = productByNormName.get(normalizeKey(c));
      if (matched) break;
    }

    const expectedPrimaryId = insumoIdByKey[seed.insumoKey] || '';
    const expectedExtras: StockComponent[] = (seed.extraInsumos || [])
      .map((ex) => ({
        insumoId: insumoIdByKey[ex.insumoKey] || '',
        qtyPerUnit: ex.qtyPerUnit,
      }))
      .filter((x) => x.insumoId && x.qtyPerUnit > 0);

    if (!matched) {
      const ref = doc(collection(db, 'products'));
      batch.set(ref, {
        ownerId,
        name: seed.name,
        category: seed.category,
        price: seed.price,
        costPrice: seed.costPrice,
        insumoId: expectedPrimaryId,
        insumoQtyPerUnit: seed.insumoQtyPerUnit,
        ...(expectedExtras.length > 0 ? { extraInsumos: expectedExtras } : {}),
        active: true,
        imageKey: seed.imageKey,
        description: seed.description,
        createdAt: now,
        updatedAt: now,
      });
      handledProductIds.add(ref.id);
      opsCount++;
      addedProducts++;
    } else {
      handledProductIds.add(matched.id);
      const needsPrimaryFix =
        !matched.insumoId ||
        matched.insumoQtyPerUnit <= 0 ||
        (seed.key === 'prod_guarana_lata' && matched.insumoId !== expectedPrimaryId);
      const existingExtrasCount = matched.extraInsumos?.length || 0;
      const needsExtrasFix = expectedExtras.length > 0 && existingExtrasCount === 0;

      if (needsPrimaryFix || needsExtrasFix) {
        const nextPrimary = needsPrimaryFix ? expectedPrimaryId : matched.insumoId;
        const nextQty =
          matched.insumoQtyPerUnit > 0 ? matched.insumoQtyPerUnit : seed.insumoQtyPerUnit;
        const nextExtras = needsExtrasFix ? expectedExtras : matched.extraInsumos || [];

        batch.update(doc(db, 'products', matched.id), {
          insumoId: nextPrimary,
          insumoQtyPerUnit: nextQty,
          extraInsumos: nextExtras,
          updatedAt: now,
        });
        opsCount++;
        linkedProducts++;
      }
    }
  }

  // 3. Auto-link any remaining custom product that currently has no insumoId
  for (const prod of existingProducts) {
    if (handledProductIds.has(prod.id)) continue;
    if (!prod.insumoId || prod.insumoQtyPerUnit <= 0) {
      const normName = normalizeKey(prod.name);
      let targetInsumo = insumoByNormName.get(normName);

      if (!targetInsumo) {
        const insRef = doc(collection(db, 'insumos'));
        batch.set(insRef, {
          ownerId,
          name: sanitizeString(prod.name, LIMITS.name),
          unit: 'un',
          currentStock: 20,
          minStock: 5,
          unitCost: Math.max(0, Number(prod.costPrice) || 0),
          supplier: 'Estoque Padrão',
          createdAt: now,
          updatedAt: now,
        });
        targetInsumo = {
          id: insRef.id,
          ownerId,
          name: prod.name,
          unit: 'un',
          currentStock: 20,
          minStock: 5,
          unitCost: prod.costPrice,
          supplier: 'Estoque Padrão',
        };
        insumoByNormName.set(normName, targetInsumo);
        opsCount++;
        addedInsumos++;
      }

      batch.update(doc(db, 'products', prod.id), {
        insumoId: targetInsumo.id,
        insumoQtyPerUnit: prod.insumoQtyPerUnit > 0 ? prod.insumoQtyPerUnit : 1,
        updatedAt: now,
      });
      opsCount++;
      linkedProducts++;
    }
  }

  if (opsCount === 0) {
    return { addedProducts: 0, addedInsumos: 0, linkedProducts: 0 };
  }

  try {
    await batch.commit();
    return { addedProducts, addedInsumos, linkedProducts };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'syncCompleteCatalogAndStockLinks');
  }
}

export async function saveStoreSettings(
  ownerId: string,
  updates: Omit<StoreSettings, 'ownerId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const ref = doc(db, 'storeSettings', ownerId);
  try {
    await updateDoc(ref, {
      storeName: sanitizeString(updates.storeName, LIMITS.storeName) || 'Brasa de Domingo',
      ownerWhatsapp: sanitizeString(updates.ownerWhatsapp, LIMITS.whatsapp),
      pixKey: sanitizeString(updates.pixKey, LIMITS.pixKey),
      address: sanitizeString(updates.address, LIMITS.address),
      operatingHours: sanitizeString(updates.operatingHours, LIMITS.operatingHours),
      customerNotice: sanitizeString(updates.customerNotice, LIMITS.customerNotice),
      confirmTemplate: sanitizeString(updates.confirmTemplate, LIMITS.template),
      readyTemplate: sanitizeString(updates.readyTemplate, LIMITS.template),
      fiadoTemplate: sanitizeString(updates.fiadoTemplate, LIMITS.template),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `storeSettings/${ownerId}`);
  }
}

export async function addCustomHoliday(
  ownerId: string,
  date: string,
  name: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'customHolidays'), {
      ownerId,
      date: sanitizeString(date, 10),
      name: sanitizeString(name, LIMITS.name) || 'Feriado',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'customHolidays');
  }
}

export async function deleteCustomHoliday(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'customHolidays', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `customHolidays/${id}`);
  }
}

export async function saveProduct(
  ownerId: string,
  product: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  autoCreateInsumo?: {
    enabled: boolean;
    initialStock: number;
    minStock: number;
    unit: InsumoUnit;
    supplier: string;
  }
): Promise<void> {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  let resolvedInsumoId = sanitizeString(product.insumoId, LIMITS.id);
  let resolvedQty = Math.max(0, Number(product.insumoQtyPerUnit) || 0);

  if (!resolvedInsumoId && autoCreateInsumo?.enabled) {
    const newInsumoRef = doc(collection(db, 'insumos'));
    resolvedInsumoId = newInsumoRef.id;
    resolvedQty = resolvedQty > 0 ? resolvedQty : 1;

    batch.set(newInsumoRef, {
      ownerId,
      name: sanitizeString(product.name, LIMITS.name) || 'Insumo',
      unit: autoCreateInsumo.unit || 'un',
      currentStock: Math.max(0, Number(autoCreateInsumo.initialStock) || 0),
      minStock: Math.max(0, Number(autoCreateInsumo.minStock) || 0),
      unitCost: Math.max(0, Number(product.costPrice) || 0),
      supplier: sanitizeString(autoCreateInsumo.supplier || 'Estoque Próprio', LIMITS.supplier),
      createdAt: now,
      updatedAt: now,
    });
  }

  const cleanExtras = (product.extraInsumos || [])
    .filter((c) => c && c.insumoId && c.insumoId !== resolvedInsumoId && c.qtyPerUnit > 0)
    .slice(0, 10)
    .map((c) => ({
      insumoId: sanitizeString(c.insumoId, LIMITS.id),
      qtyPerUnit: Math.max(0.01, Number(c.qtyPerUnit) || 0),
    }));

  const payload = {
    name: sanitizeString(product.name, LIMITS.name) || 'Produto',
    category: product.category,
    price: Math.max(0, Number(product.price) || 0),
    costPrice: Math.max(0, Number(product.costPrice) || 0),
    insumoId: resolvedInsumoId,
    insumoQtyPerUnit: resolvedInsumoId ? Math.max(0.01, resolvedQty || 1) : 0,
    extraInsumos: cleanExtras,
    active: Boolean(product.active),
    imageKey: product.imageKey,
    description: sanitizeString(product.description, LIMITS.description),
    updatedAt: now,
  };

  if (existingId) {
    batch.update(doc(db, 'products', existingId), payload);
  } else {
    const prodRef = doc(collection(db, 'products'));
    batch.set(prodRef, {
      ownerId,
      ...payload,
      createdAt: now,
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      existingId ? `products/${existingId}` : 'products'
    );
  }
}

export async function toggleProductActive(id: string, active: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'products', id), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
  }
}

export async function saveInsumo(
  ownerId: string,
  insumo: Omit<Insumo, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<void> {
  const payload = {
    name: sanitizeString(insumo.name, LIMITS.name) || 'Insumo',
    unit: insumo.unit,
    currentStock: Math.max(0, Number(insumo.currentStock) || 0),
    minStock: Math.max(0, Number(insumo.minStock) || 0),
    unitCost: Math.max(0, Number(insumo.unitCost) || 0),
    supplier: sanitizeString(insumo.supplier, LIMITS.supplier),
    updatedAt: serverTimestamp(),
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'insumos', existingId), payload);
    } else {
      await addDoc(collection(db, 'insumos'), {
        ownerId,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      existingId ? `insumos/${existingId}` : 'insumos'
    );
  }
}

export async function replenishInsumo(
  ownerId: string,
  insumo: Insumo,
  addedQty: number,
  recordExpense: boolean,
  expenseDate: string,
  expenseAmount: number
): Promise<void> {
  const batch = writeBatch(db);
  const insumoRef = doc(db, 'insumos', insumo.id);
  batch.update(insumoRef, {
    currentStock: Math.max(0, Number((insumo.currentStock + addedQty).toFixed(2))),
    updatedAt: serverTimestamp(),
  });

  if (recordExpense && expenseAmount > 0) {
    const expRef = doc(collection(db, 'dailyExpenses'));
    batch.set(expRef, {
      ownerId,
      date: sanitizeString(expenseDate, 10),
      description: sanitizeString(`Reposição: ${addedQty} ${insumo.unit} de ${insumo.name}`, LIMITS.expenseDescription),
      category: insumo.name.toLowerCase().includes('carv') ? 'carvao' : 'insumos',
      amount: Math.max(0.01, Number(expenseAmount.toFixed(2))),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `insumos/${insumo.id}`);
  }
}

export async function deleteInsumo(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'insumos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `insumos/${id}`);
  }
}

export async function saveCustomer(
  ownerId: string,
  customer: { name: string; whatsapp: string; neighborhood: string; notes: string },
  existingId?: string
): Promise<string> {
  const payload = {
    name: sanitizeString(customer.name, LIMITS.name) || 'Cliente',
    whatsapp: sanitizeString(customer.whatsapp, LIMITS.whatsapp),
    neighborhood: sanitizeString(customer.neighborhood, LIMITS.neighborhood),
    notes: sanitizeString(customer.notes, LIMITS.description),
    updatedAt: serverTimestamp(),
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'customers', existingId), payload);
      return existingId;
    } else {
      const ref = await addDoc(collection(db, 'customers'), {
        ownerId,
        ...payload,
        fiadoBalance: 0,
        totalSpent: 0,
        ordersCount: 0,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      existingId ? `customers/${existingId}` : 'customers'
    );
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'customers', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
  }
}

export async function createOrderAtomic(params: {
  ownerId: string;
  orderNumber: number;
  saleDate: string;
  customHolidays: CustomHoliday[];
  customer: Customer | null;
  existingCustomers?: Customer[];
  customerName: string;
  customerWhatsapp: string;
  deliveryType: Order['deliveryType'];
  items: OrderItem[];
  discount: number;
  paymentMethod: PaymentMethod;
  orderStatus: OrderStatus;
  notes: string;
  insumos: Insumo[];
  products?: Product[];
}): Promise<string> {
  const opInfo = checkOperatingDay(params.saleDate, params.customHolidays);
  if (!opInfo.isOperating || !opInfo.dayType) {
    throw new Error('Operação permitida somente aos domingos e feriados cadastrados.');
  }

  const boundedItems = params.items
    .slice(0, LIMITS.maxOrderItems)
    .map((item) => sanitizeOrderItem(item, params.products));
  if (boundedItems.length === 0) {
    throw new Error('Adicione pelo menos 1 item ao pedido.');
  }

  const subtotal = Number(
    boundedItems.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)
  );
  const discount = Math.max(0, Math.min(subtotal, Number(params.discount) || 0));
  const total = Number((subtotal - discount).toFixed(2));
  const estimatedCost = Number(
    boundedItems.reduce((acc, i) => acc + i.unitCost * i.quantity, 0).toFixed(2)
  );
  const estimatedProfit = Number((total - estimatedCost).toFixed(2));

  const isFiado = params.paymentMethod === 'fiado';
  const paymentStatus = isFiado ? 'fiado_pendente' : 'pago';
  const paidAmount = isFiado ? 0 : total;

  // Resolve or auto-create customer if WhatsApp was provided
  const cleanName = sanitizeString(params.customerName || 'Cliente Balcão', LIMITS.name);
  const cleanWhatsapp = sanitizeString(params.customerWhatsapp, LIMITS.whatsapp);
  const normalizedPhone = cleanWhatsapp.replace(/\D/g, '');

  let linkedCustomer = params.customer;
  if (!linkedCustomer && params.existingCustomers && normalizedPhone.length >= 8) {
    linkedCustomer =
      params.existingCustomers.find(
        (c) => c.whatsapp.replace(/\D/g, '') === normalizedPhone
      ) || null;
  }

  // Aggregate exact stock deductions across primary + combo/recipe insumos
  const stockDeductions: Record<string, number> = {};
  for (const item of boundedItems) {
    const links = getItemStockLinks(item, params.products);
    for (const link of links) {
      stockDeductions[link.insumoId] = Number(
        ((stockDeductions[link.insumoId] || 0) + link.qtyPerUnit * item.quantity).toFixed(2)
      );
    }
  }

  const orderRef = doc(collection(db, 'orders'));

  try {
    await runTransaction(db, async (tx) => {
      const now = serverTimestamp();

      // 1. Read all affected insumos and customer documents FIRST
      const insumoEntries = Object.entries(stockDeductions);
      const insumoSnaps = await Promise.all(
        insumoEntries.map(([id]) => tx.get(doc(db, 'insumos', id)))
      );

      const custSnap = linkedCustomer
        ? await tx.get(doc(db, 'customers', linkedCustomer.id))
        : null;

      // 2. Validate live stock on the server before mutating anything
      const insumoUpdates: { id: string; nextStock: number }[] = [];
      for (let i = 0; i < insumoEntries.length; i++) {
        const [insumoId, deductQty] = insumoEntries[i];
        const insSnap = insumoSnaps[i];
        if (!insSnap.exists()) continue;

        const data = insSnap.data();
        const liveStock = Math.max(0, Number(data.currentStock) || 0);
        if (liveStock < deductQty) {
          throw new Error(
            `Estoque insuficiente de "${data.name}" (disponível: ${liveStock} ${data.unit}, solicitado: ${deductQty} ${data.unit}).`
          );
        }
        insumoUpdates.push({
          id: insumoId,
          nextStock: Math.max(0, Number((liveStock - deductQty).toFixed(2))),
        });
      }

      // 3. Apply customer update/creation
      let resolvedCustomerId = linkedCustomer ? linkedCustomer.id : '';
      if (linkedCustomer && custSnap && custSnap.exists()) {
        const cData = custSnap.data();
        const liveFiado = Number(cData.fiadoBalance) || 0;
        const liveSpent = Number(cData.totalSpent) || 0;
        const liveOrders = Number(cData.ordersCount) || 0;

        tx.update(doc(db, 'customers', linkedCustomer.id), {
          fiadoBalance: isFiado ? Number((liveFiado + total).toFixed(2)) : liveFiado,
          totalSpent: Number((liveSpent + total).toFixed(2)),
          ordersCount: liveOrders + 1,
          updatedAt: now,
        });
      } else if (cleanName !== 'Cliente Balcão' && normalizedPhone.length >= 8) {
        const newCustRef = doc(collection(db, 'customers'));
        resolvedCustomerId = newCustRef.id;
        tx.set(newCustRef, {
          ownerId: params.ownerId,
          name: cleanName,
          whatsapp: cleanWhatsapp,
          neighborhood: '',
          notes: 'Cadastrado automaticamente via pedido',
          fiadoBalance: isFiado ? total : 0,
          totalSpent: total,
          ordersCount: 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      // 4. Write the order
      tx.set(orderRef, {
        ownerId: params.ownerId,
        orderNumber: params.orderNumber,
        saleDate: params.saleDate,
        dayType: opInfo.dayType,
        holidayName: sanitizeString(opInfo.holidayName, LIMITS.name),
        customerId: resolvedCustomerId,
        customerName: cleanName,
        customerWhatsapp: cleanWhatsapp,
        deliveryType: params.deliveryType,
        items: boundedItems,
        subtotal,
        discount,
        total,
        estimatedCost,
        estimatedProfit,
        paymentMethod: params.paymentMethod,
        paymentStatus,
        paidAmount,
        orderStatus: params.orderStatus,
        notes: sanitizeString(params.notes, LIMITS.notes),
        createdAt: now,
        updatedAt: now,
      });

      // 5. Deduct live stock units for every linked insumo
      for (const upd of insumoUpdates) {
        tx.update(doc(db, 'insumos', upd.id), {
          currentStock: upd.nextStock,
          updatedAt: now,
        });
      }

      // 6. Log fiado transaction if applicable
      if (isFiado && resolvedCustomerId && total > 0) {
        const txRef = doc(collection(db, 'fiadoTransactions'));
        const summary = boundedItems.map((i) => `${i.quantity}x ${i.productName}`).join(', ');
        tx.set(txRef, {
          ownerId: params.ownerId,
          customerId: resolvedCustomerId,
          customerName: cleanName,
          orderId: orderRef.id,
          type: 'debito',
          amount: total,
          description: sanitizeString(`Pedido #${params.orderNumber} — ${summary}`, LIMITS.txDescription),
          paymentMethod: 'fiado',
          date: params.saleDate,
          createdAt: now,
        });
      }
    });

    return orderRef.id;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Estoque insuficiente')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, 'orders');
  }
}

export async function updateOrderStatus(order: Order, nextStatus: OrderStatus): Promise<void> {
  try {
    await updateDoc(doc(db, 'orders', order.id), {
      orderStatus: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function updateOrderDate(
  ownerId: string,
  order: Order,
  nextDate: string,
  customHolidays: CustomHoliday[],
  allowRegisterHolidayIfWeekday = false
): Promise<void> {
  if (order.orderStatus === 'cancelado') {
    throw new Error('Pedidos cancelados não podem ter a data modificada.');
  }

  let opInfo = checkOperatingDay(nextDate, customHolidays);
  const batch = writeBatch(db);
  const now = serverTimestamp();

  if (!opInfo.isOperating) {
    if (!allowRegisterHolidayIfWeekday) {
      throw new Error('Escolha um domingo/feriado ou ative a opção para liberar a data como feriado especial.');
    }
    const holidayRef = doc(collection(db, 'customHolidays'));
    const holidayLabel = 'Feriado / Dia Especial';
    batch.set(holidayRef, {
      ownerId,
      date: sanitizeString(nextDate, 10),
      name: holidayLabel,
      createdAt: now,
    });
    opInfo = {
      isOperating: true,
      dayType: 'feriado',
      holidayName: holidayLabel,
      label: `Feriado · ${holidayLabel}`,
      dateStr: nextDate,
    };
  }

  batch.update(doc(db, 'orders', order.id), {
    saleDate: sanitizeString(nextDate, 10),
    dayType: opInfo.dayType ?? 'domingo',
    holidayName: sanitizeString(opInfo.holidayName, LIMITS.name),
    updatedAt: now,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function updateExpenseDate(expenseId: string, nextDate: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'dailyExpenses', expenseId), {
      date: sanitizeString(nextDate, 10),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dailyExpenses/${expenseId}`);
  }
}

export async function cancelOrderAtomic(
  order: Order,
  _insumos: Insumo[],
  _customers: Customer[],
  products?: Product[]
): Promise<void> {
  if (order.orderStatus === 'cancelado') return;

  const stockRestores: Record<string, number> = {};
  for (const item of order.items) {
    const links = getItemStockLinks(item, products);
    for (const link of links) {
      stockRestores[link.insumoId] = Number(
        ((stockRestores[link.insumoId] || 0) + link.qtyPerUnit * item.quantity).toFixed(2)
      );
    }
  }

  try {
    await runTransaction(db, async (tx) => {
      const now = serverTimestamp();
      const orderRef = doc(db, 'orders', order.id);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists() || orderSnap.data().orderStatus === 'cancelado') {
        return;
      }

      const restoreEntries = Object.entries(stockRestores);
      const insumoSnaps = await Promise.all(
        restoreEntries.map(([id]) => tx.get(doc(db, 'insumos', id)))
      );

      const hasPendingFiado = Boolean(order.customerId && order.paymentStatus !== 'pago');
      const custSnap = hasPendingFiado
        ? await tx.get(doc(db, 'customers', order.customerId))
        : null;

      tx.update(orderRef, {
        orderStatus: 'cancelado',
        updatedAt: now,
      });

      for (let i = 0; i < restoreEntries.length; i++) {
        const [insumoId, qty] = restoreEntries[i];
        const snap = insumoSnaps[i];
        if (!snap.exists()) continue;
        const liveStock = Math.max(0, Number(snap.data().currentStock) || 0);
        tx.update(doc(db, 'insumos', insumoId), {
          currentStock: Number((liveStock + qty).toFixed(2)),
          updatedAt: now,
        });
      }

      if (hasPendingFiado && custSnap && custSnap.exists()) {
        const liveFiado = Number(custSnap.data().fiadoBalance) || 0;
        const remainingDebt = Math.max(0, order.total - order.paidAmount);
        tx.update(doc(db, 'customers', order.customerId), {
          fiadoBalance: Math.max(0, Number((liveFiado - remainingDebt).toFixed(2))),
          updatedAt: now,
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${order.id}`);
  }
}

export async function registerFiadoPayment(params: {
  ownerId: string;
  customer: Customer;
  amount: number;
  paymentMethod: Exclude<PaymentMethod, 'fiado'>;
  description: string;
  date: string;
  pendingOrders: Order[];
}): Promise<void> {
  const payAmount = Math.max(0.01, Math.min(params.customer.fiadoBalance, Number(params.amount)));
  const batch = writeBatch(db);
  const now = serverTimestamp();

  const nextBalance = Math.max(0, Number((params.customer.fiadoBalance - payAmount).toFixed(2)));
  batch.update(doc(db, 'customers', params.customer.id), {
    fiadoBalance: nextBalance,
    updatedAt: now,
  });

  batch.set(doc(collection(db, 'fiadoTransactions')), {
    ownerId: params.ownerId,
    customerId: params.customer.id,
    customerName: sanitizeString(params.customer.name, LIMITS.name) || 'Cliente',
    orderId: '',
    type: 'pagamento',
    amount: payAmount,
    description: sanitizeString(params.description, LIMITS.txDescription) || 'Abatimento de fiado',
    paymentMethod: params.paymentMethod,
    date: sanitizeString(params.date, 10),
    createdAt: now,
  });

  // Allocate payment across open fiado orders oldest-first
  let remainingToAllocate = payAmount;
  const sortedOpen = [...params.pendingOrders]
    .filter((o) => o.customerId === params.customer.id && o.orderStatus !== 'cancelado' && o.paymentStatus !== 'pago')
    .sort((a, b) => a.saleDate.localeCompare(b.saleDate));

  for (const ord of sortedOpen) {
    if (remainingToAllocate <= 0) break;
    const owed = Math.max(0, Number((ord.total - ord.paidAmount).toFixed(2)));
    if (owed <= 0) continue;

    const applied = Math.min(owed, remainingToAllocate);
    const nextPaid = Number((ord.paidAmount + applied).toFixed(2));
    const nextPaymentStatus = nextPaid >= ord.total - 0.01 ? 'pago' : 'fiado_parcial';

    batch.update(doc(db, 'orders', ord.id), {
      paidAmount: nextPaid,
      paymentStatus: nextPaymentStatus,
      updatedAt: now,
    });

    remainingToAllocate = Number((remainingToAllocate - applied).toFixed(2));
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `customers/${params.customer.id}`);
  }
}

export async function addDailyExpense(
  ownerId: string,
  expense: Omit<DailyExpense, 'id' | 'ownerId' | 'createdAt'>
): Promise<void> {
  try {
    await addDoc(collection(db, 'dailyExpenses'), {
      ownerId,
      date: sanitizeString(expense.date, 10),
      description: sanitizeString(expense.description, LIMITS.expenseDescription) || 'Despesa operacional',
      category: expense.category,
      amount: Math.max(0.01, Number(expense.amount) || 0),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'dailyExpenses');
  }
}

export async function deleteDailyExpense(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'dailyExpenses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `dailyExpenses/${id}`);
  }
}

export async function logWhatsappDispatch(params: {
  ownerId: string;
  customerId: string;
  customerName: string;
  whatsapp: string;
  orderId: string;
  type: WhatsappLogType;
  message: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'whatsappLogs'), {
      ownerId: params.ownerId,
      customerId: sanitizeString(params.customerId, LIMITS.id),
      customerName: sanitizeString(params.customerName, LIMITS.name) || 'Cliente',
      whatsapp: sanitizeString(params.whatsapp, LIMITS.whatsapp),
      orderId: sanitizeString(params.orderId, LIMITS.id),
      type: params.type,
      message: sanitizeString(params.message, LIMITS.whatsappMessage) || 'Mensagem WhatsApp',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'whatsappLogs');
  }
}

export async function addManualFiadoDebit(params: {
  ownerId: string;
  customer: Customer;
  amount: number;
  description: string;
  date: string;
}): Promise<void> {
  const debitAmount = Math.max(0.01, Number(params.amount));
  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.update(doc(db, 'customers', params.customer.id), {
    fiadoBalance: Number((params.customer.fiadoBalance + debitAmount).toFixed(2)),
    updatedAt: now,
  });

  batch.set(doc(collection(db, 'fiadoTransactions')), {
    ownerId: params.ownerId,
    customerId: params.customer.id,
    customerName: sanitizeString(params.customer.name, LIMITS.name) || 'Cliente',
    orderId: '',
    type: 'debito',
    amount: debitAmount,
    description: sanitizeString(params.description, LIMITS.txDescription) || 'Lançamento manual na caderneta',
    paymentMethod: 'fiado',
    date: sanitizeString(params.date, 10),
    createdAt: now,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `customers/${params.customer.id}`);
  }
}

export async function importBackupToFirestore(
  ownerId: string,
  rawPayload: unknown
): Promise<{ importedCount: number }> {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Arquivo ou dados de backup inválidos.');
  }

  const data = rawPayload as Record<string, unknown>;
  const now = serverTimestamp();
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  const validDate = (val: unknown, fallback = '2026-01-04'): string => {
    const str = typeof val === 'string' ? val.trim().slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : fallback;
  };

  if (data.settings && typeof data.settings === 'object') {
    const s = data.settings as Record<string, unknown>;
    operations.push((batch) => {
      batch.update(doc(db, 'storeSettings', ownerId), {
        storeName: sanitizeString(String(s.storeName || ''), LIMITS.storeName) || 'Brasa de Domingo',
        ownerWhatsapp: sanitizeString(String(s.ownerWhatsapp || ''), LIMITS.whatsapp),
        pixKey: sanitizeString(String(s.pixKey || ''), LIMITS.pixKey),
        address: sanitizeString(String(s.address || ''), LIMITS.address),
        operatingHours: sanitizeString(String(s.operatingHours || ''), LIMITS.operatingHours),
        customerNotice: sanitizeString(String(s.customerNotice || ''), LIMITS.customerNotice),
        confirmTemplate: sanitizeString(String(s.confirmTemplate || ''), LIMITS.template),
        readyTemplate: sanitizeString(String(s.readyTemplate || ''), LIMITS.template),
        fiadoTemplate: sanitizeString(String(s.fiadoTemplate || ''), LIMITS.template),
        updatedAt: now,
      });
    });
  }

  const insumoIdMap: Record<string, string> = {};
  if (Array.isArray(data.insumos)) {
    const existingSnap = await getDocs(query(collection(db, 'insumos'), where('ownerId', '==', ownerId)));
    const existingByName = new Map<string, string>();
    existingSnap.docs.forEach((d) => {
      const name = String(d.data().name || '');
      existingByName.set(normalizeKey(name), d.id);
    });

    for (const raw of data.insumos) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const name = sanitizeString(String(item.name || ''), LIMITS.name);
      if (!name) continue;
      const unit = ['un', 'kg', 'L', 'pct'].includes(String(item.unit)) ? String(item.unit) : 'un';
      const existingId = existingByName.get(normalizeKey(name));
      const targetRef = existingId ? doc(db, 'insumos', existingId) : doc(collection(db, 'insumos'));
      if (typeof item.id === 'string') {
        insumoIdMap[item.id] = targetRef.id;
      }

      if (existingId) {
        operations.push((batch) => {
          batch.update(targetRef, {
            name,
            unit,
            currentStock: Math.max(0, Number(item.currentStock) || 0),
            minStock: Math.max(0, Number(item.minStock) || 0),
            unitCost: Math.max(0, Number(item.unitCost) || 0),
            supplier: sanitizeString(String(item.supplier || ''), LIMITS.supplier),
            updatedAt: now,
          });
        });
      } else {
        operations.push((batch) => {
          batch.set(targetRef, {
            ownerId,
            name,
            unit,
            currentStock: Math.max(0, Number(item.currentStock) || 0),
            minStock: Math.max(0, Number(item.minStock) || 0),
            unitCost: Math.max(0, Number(item.unitCost) || 0),
            supplier: sanitizeString(String(item.supplier || ''), LIMITS.supplier),
            createdAt: now,
            updatedAt: now,
          });
        });
      }
    }
  }

  const productIdMap: Record<string, string> = {};
  if (Array.isArray(data.products)) {
    const existingSnap = await getDocs(query(collection(db, 'products'), where('ownerId', '==', ownerId)));
    const existingByName = new Map<string, string>();
    existingSnap.docs.forEach((d) => {
      existingByName.set(normalizeKey(String(d.data().name || '')), d.id);
    });

    for (const raw of data.products) {
      if (!raw || typeof raw !== 'object') continue;
      const p = raw as Record<string, unknown>;
      const name = sanitizeString(String(p.name || ''), LIMITS.name);
      if (!name) continue;
      const category = ['espetinho', 'bebida', 'acompanhamento', 'combo'].includes(String(p.category))
        ? String(p.category)
        : 'espetinho';
      const imageKey = ['espetinho_carne', 'linguica_coracao', 'bebidas_geladas', 'brasa_geral'].includes(
        String(p.imageKey)
      )
        ? String(p.imageKey)
        : 'brasa_geral';

      const mappedPrimary = insumoIdMap[String(p.insumoId || '')] || sanitizeString(String(p.insumoId || ''), LIMITS.id);
      const rawExtras = Array.isArray(p.extraInsumos) ? p.extraInsumos : [];
      const mappedExtras = rawExtras
        .filter((e): e is Record<string, unknown> => Boolean(e && typeof e === 'object'))
        .slice(0, 10)
        .map((e) => ({
          insumoId: insumoIdMap[String(e.insumoId || '')] || sanitizeString(String(e.insumoId || ''), LIMITS.id),
          qtyPerUnit: Math.max(0.01, Number(e.qtyPerUnit) || 1),
        }))
        .filter((e) => e.insumoId);

      const existingId = existingByName.get(normalizeKey(name));
      const targetRef = existingId ? doc(db, 'products', existingId) : doc(collection(db, 'products'));
      if (typeof p.id === 'string') {
        productIdMap[p.id] = targetRef.id;
      }

      const body = {
        name,
        category,
        price: Math.max(0, Number(p.price) || 0),
        costPrice: Math.max(0, Number(p.costPrice) || 0),
        insumoId: mappedPrimary,
        insumoQtyPerUnit: mappedPrimary ? Math.max(0.01, Number(p.insumoQtyPerUnit) || 1) : 0,
        extraInsumos: mappedExtras,
        active: p.active !== false,
        imageKey,
        description: sanitizeString(String(p.description || ''), LIMITS.description),
        updatedAt: now,
      };

      if (existingId) {
        operations.push((batch) => batch.update(targetRef, body));
      } else {
        operations.push((batch) => batch.set(targetRef, { ownerId, ...body, createdAt: now }));
      }
    }
  }

  const customerIdMap: Record<string, string> = {};
  if (Array.isArray(data.customers)) {
    const existingSnap = await getDocs(query(collection(db, 'customers'), where('ownerId', '==', ownerId)));
    const existingByPhoneOrName = new Map<string, string>();
    existingSnap.docs.forEach((d) => {
      const cData = d.data();
      const phone = String(cData.whatsapp || '').replace(/\D/g, '');
      if (phone) existingByPhoneOrName.set(`p:${phone}`, d.id);
      existingByPhoneOrName.set(`n:${normalizeKey(String(cData.name || ''))}`, d.id);
    });

    for (const raw of data.customers) {
      if (!raw || typeof raw !== 'object') continue;
      const c = raw as Record<string, unknown>;
      const name = sanitizeString(String(c.name || ''), LIMITS.name);
      if (!name) continue;
      const whatsapp = sanitizeString(String(c.whatsapp || ''), LIMITS.whatsapp);
      const phone = whatsapp.replace(/\D/g, '');
      const existingId =
        (phone ? existingByPhoneOrName.get(`p:${phone}`) : undefined) ||
        existingByPhoneOrName.get(`n:${normalizeKey(name)}`);

      if (existingId) {
        if (typeof c.id === 'string') customerIdMap[c.id] = existingId;
      } else {
        const ref = doc(collection(db, 'customers'));
        if (typeof c.id === 'string') customerIdMap[c.id] = ref.id;
        operations.push((batch) => {
          batch.set(ref, {
            ownerId,
            name,
            whatsapp,
            neighborhood: sanitizeString(String(c.neighborhood || ''), LIMITS.neighborhood),
            notes: sanitizeString(String(c.notes || ''), LIMITS.description),
            fiadoBalance: Math.max(0, Number(c.fiadoBalance) || 0),
            totalSpent: Math.max(0, Number(c.totalSpent) || 0),
            ordersCount: Math.max(0, Number(c.ordersCount) || 0),
            createdAt: now,
            updatedAt: now,
          });
        });
      }
    }
  }

  if (Array.isArray(data.customHolidays)) {
    for (const raw of data.customHolidays) {
      if (!raw || typeof raw !== 'object') continue;
      const h = raw as Record<string, unknown>;
      const name = sanitizeString(String(h.name || ''), LIMITS.name);
      if (!name) continue;
      operations.push((batch) => {
        batch.set(doc(collection(db, 'customHolidays')), {
          ownerId,
          date: validDate(h.date),
          name,
          createdAt: now,
        });
      });
    }
  }

  if (Array.isArray(data.orders)) {
    const existingOrders = await getDocs(query(collection(db, 'orders'), where('ownerId', '==', ownerId)));
    const existingNumbers = new Set<number>(existingOrders.docs.map((d) => Number(d.data().orderNumber) || 0));

    for (const raw of data.orders) {
      if (!raw || typeof raw !== 'object') continue;
      const o = raw as Record<string, unknown>;
      const orderNumber = Math.max(1, Number(o.orderNumber) || 0);
      if (existingNumbers.has(orderNumber)) continue;
      const rawItems = Array.isArray(o.items) ? o.items : [];
      if (rawItems.length === 0) continue;

      const items = rawItems
        .filter((i): i is Record<string, unknown> => Boolean(i && typeof i === 'object'))
        .slice(0, LIMITS.maxOrderItems)
        .map((i) => ({
          productId: productIdMap[String(i.productId || '')] || sanitizeString(String(i.productId || ''), LIMITS.id),
          productName: sanitizeString(String(i.productName || ''), LIMITS.name) || 'Item',
          category: ['espetinho', 'bebida', 'acompanhamento', 'combo'].includes(String(i.category))
            ? (String(i.category) as OrderItem['category'])
            : 'espetinho',
          quantity: Math.max(1, Number(i.quantity) || 1),
          unitPrice: Math.max(0, Number(i.unitPrice) || 0),
          unitCost: Math.max(0, Number(i.unitCost) || 0),
          subtotal: Math.max(0, Number(i.subtotal) || 0),
          insumoId: insumoIdMap[String(i.insumoId || '')] || sanitizeString(String(i.insumoId || ''), LIMITS.id),
          insumoQtyPerUnit: Math.max(0, Number(i.insumoQtyPerUnit) || 0),
        }));

      if (items.length === 0) continue;
      existingNumbers.add(orderNumber);

      operations.push((batch) => {
        batch.set(doc(collection(db, 'orders')), {
          ownerId,
          orderNumber,
          saleDate: validDate(o.saleDate),
          dayType: o.dayType === 'feriado' ? 'feriado' : 'domingo',
          holidayName: sanitizeString(String(o.holidayName || ''), LIMITS.name),
          customerId: customerIdMap[String(o.customerId || '')] || '',
          customerName: sanitizeString(String(o.customerName || ''), LIMITS.name) || 'Cliente',
          customerWhatsapp: sanitizeString(String(o.customerWhatsapp || ''), LIMITS.whatsapp),
          deliveryType: ['balcao', 'retirada', 'entrega'].includes(String(o.deliveryType))
            ? String(o.deliveryType)
            : 'balcao',
          items,
          subtotal: Math.max(0, Number(o.subtotal) || 0),
          discount: Math.max(0, Number(o.discount) || 0),
          total: Math.max(0, Number(o.total) || 0),
          estimatedCost: Math.max(0, Number(o.estimatedCost) || 0),
          estimatedProfit: Number(o.estimatedProfit) || 0,
          paymentMethod: ['pix', 'dinheiro', 'cartao', 'fiado'].includes(String(o.paymentMethod))
            ? String(o.paymentMethod)
            : 'pix',
          paymentStatus: ['pago', 'fiado_pendente', 'fiado_parcial'].includes(String(o.paymentStatus))
            ? String(o.paymentStatus)
            : 'pago',
          paidAmount: Math.max(0, Number(o.paidAmount) || 0),
          orderStatus: ['novo', 'confirmado', 'na_brasa', 'pronto', 'entregue', 'cancelado'].includes(
            String(o.orderStatus)
          )
            ? String(o.orderStatus)
            : 'confirmado',
          notes: sanitizeString(String(o.notes || ''), LIMITS.notes),
          createdAt: now,
          updatedAt: now,
        });
      });
    }
  }

  const rawExpenses = Array.isArray(data.expenses)
    ? data.expenses
    : Array.isArray(data.dailyExpenses)
      ? data.dailyExpenses
      : [];
  for (const raw of rawExpenses) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const desc = sanitizeString(String(e.description || ''), LIMITS.expenseDescription);
    const amount = Number(e.amount) || 0;
    if (!desc || amount <= 0) continue;
    operations.push((batch) => {
      batch.set(doc(collection(db, 'dailyExpenses')), {
        ownerId,
        date: validDate(e.date),
        description: desc,
        category: ['carvao', 'insumos', 'gelo', 'gas', 'outros'].includes(String(e.category))
          ? String(e.category)
          : 'outros',
        amount: Math.max(0.01, Number(amount.toFixed(2))),
        createdAt: now,
      });
    });
  }

  for (let i = 0; i < operations.length; i += 400) {
    const chunk = operations.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((op) => op(batch));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'importBackupToFirestore');
    }
  }

  return { importedCount: operations.length };
}
