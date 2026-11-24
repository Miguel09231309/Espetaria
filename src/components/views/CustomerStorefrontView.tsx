import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Copy,
  Check,
} from 'lucide-react';
import {
  CustomHoliday,
  Customer,
  DeliveryType,
  Insumo,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  ProductCategory,
  StoreSettings,
} from '../../types';
import { IMAGE_ASSETS } from '../../data/seedData';
import {
  buildWhatsAppLink,
  formatBRL,
} from '../../utils/format';
import {
  checkOperatingDay,
  formatDateBR,
  getDefaultOperatingDate,
  getOperatingDateOptions,
  toLocalDateString,
} from '../../utils/holidays';
import { createOrderAtomic } from '../../services/firestoreService';
import { computeProductAvailableUnits } from '../../utils/stock';

interface Props {
  ownerId: string;
  products: Product[];
  insumos: Insumo[];
  customers: Customer[];
  orders: Order[];
  customHolidays: CustomHoliday[];
  settings: StoreSettings;
  clientOnlyMode?: boolean;
}

export const CustomerStorefrontView: React.FC<Props> = ({
  ownerId,
  products,
  insumos,
  customers,
  orders,
  customHolidays,
  settings,
  clientOnlyMode = false,
}) => {
  const [catFilter, setCatFilter] = useState<'todos' | ProductCategory>('todos');
  const [bag, setBag] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('retirada');
  const [paymentMethod, setPaymentMethod] = useState<Exclude<PaymentMethod, 'fiado'>>('pix');
  const [notes, setNotes] = useState('');
  const [copiedPix, setCopiedPix] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);

  const todayStr = toLocalDateString(new Date());
  const todayInfo = useMemo(
    () => checkOperatingDay(todayStr, customHolidays),
    [todayStr, customHolidays]
  );
  const nextOperating = useMemo(
    () => getDefaultOperatingDate(customHolidays),
    [customHolidays]
  );
  const upcomingDates = useMemo(
    () => getOperatingDateOptions(customHolidays, 0, 28).reverse(),
    [customHolidays]
  );
  const [targetDate, setTargetDate] = useState(nextOperating.dateStr);

  const targetDateInfo = useMemo(
    () => checkOperatingDay(targetDate, customHolidays),
    [targetDate, customHolidays]
  );

  const activeMenu = useMemo(
    () =>
      products
        .filter((p) => p.active)
        .filter((p) => catFilter === 'todos' || p.category === catFilter),
    [products, catFilter]
  );

  const bagTotal = useMemo(
    () => bag.reduce((acc, i) => acc + i.subtotal, 0),
    [bag]
  );

  const getAvailableStockForProduct = (prod: Product): number | null => {
    return computeProductAvailableUnits(prod, insumos, bag, products);
  };

  const addToBag = (p: Product) => {
    setOrderError(null);
    setLastOrderNumber(null);
    const avail = getAvailableStockForProduct(p);
    if (avail !== null && avail <= 0) {
      setOrderError(`Desculpe, ${p.name} está esgotado no estoque no momento.`);
      return;
    }

    setBag((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotal: Number(((i.quantity + 1) * i.unitPrice).toFixed(2)),
              }
            : i
        );
      }
      if (prev.length >= 25) return prev;
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          category: p.category,
          quantity: 1,
          unitPrice: p.price,
          unitCost: p.costPrice,
          subtotal: p.price,
          insumoId: p.insumoId,
          insumoQtyPerUnit: p.insumoQtyPerUnit,
          ...(p.extraInsumos && p.extraInsumos.length > 0
            ? { extraInsumos: p.extraInsumos }
            : {}),
        },
      ];
    });
  };

  const updateBagQty = (productId: string, delta: number) => {
    setOrderError(null);
    if (delta > 0) {
      const prod = products.find((p) => p.id === productId);
      if (prod) {
        const avail = getAvailableStockForProduct(prod);
        if (avail !== null && avail <= 0) {
          setOrderError(`Estoque máximo atingido para ${prod.name}.`);
          return;
        }
      }
    }

    setBag((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const next = i.quantity + delta;
          if (next <= 0) return null;
          return {
            ...i,
            quantity: next,
            subtotal: Number((next * i.unitPrice).toFixed(2)),
          };
        })
        .filter((x): x is OrderItem => x !== null)
    );
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(settings.pixKey);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleConfirmClientOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    if (bag.length === 0) {
      setOrderError('Adicione pelo menos 1 item na sacola.');
      return;
    }
    if (!customerName.trim()) {
      setOrderError('Informe seu nome para identificar o pedido.');
      return;
    }
    if (!targetDateInfo.isOperating) {
      setOrderError('Pedidos são aceitos somente para domingos e feriados cadastrados.');
      return;
    }

    setSavingOrder(true);
    try {
      const nextNum = orders.reduce((m, o) => Math.max(m, o.orderNumber || 0), 100) + 1;
      await createOrderAtomic({
        ownerId,
        orderNumber: nextNum,
        saleDate: targetDate,
        customHolidays,
        customer: null,
        existingCustomers: customers,
        customerName: customerName.trim(),
        customerWhatsapp: customerWhatsapp.trim(),
        deliveryType,
        items: bag,
        discount: 0,
        paymentMethod,
        orderStatus: 'novo',
        notes: notes.trim(),
        insumos,
        products,
      });

      // Estoque já foi deduzido atomicamente, pedido salvo, sem popup de mensagem
      setLastOrderNumber(nextNum);
      setBag([]);
      setNotes('');
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Erro ao confirmar pedido.');
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 lg:p-8 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span
                className={`font-semibold ${
                  todayInfo.isOperating ? 'text-emerald-400' : 'text-orange-400'
                }`}
              >
                {todayInfo.isOperating
                  ? `Aberto hoje (${todayInfo.label})`
                  : `Hoje fechado · Próximo dia: ${formatDateBR(nextOperating.dateStr)} (${nextOperating.label})`}
              </span>
              <span aria-hidden="true">·</span>
              <span>{settings.operatingHours}</span>
            </div>

            <h2 className="font-display text-3xl font-bold text-white text-balance">
              {settings.storeName}
            </h2>

            <p className="text-sm text-zinc-300 leading-relaxed max-w-xl">
              {settings.customerNotice}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800 text-xs text-zinc-400">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <span>{settings.address}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="text-zinc-500">Chave Pix:</span>{' '}
                <span className="font-mono font-medium text-zinc-100">{settings.pixKey}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyPix}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-800 rounded hover:bg-zinc-700 shrink-0"
              >
                {copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPix ? 'Copiado' : 'Pix'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!clientOnlyMode && (
              <a
                href={buildWhatsAppLink(
                  settings.ownerWhatsapp,
                  `Olá ${settings.storeName}! Gostaria de tirar uma dúvida sobre os espetinhos de domingo/feriado.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4" />
                Falar com a Barraca no WhatsApp
              </a>
            )}
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Estoque atualizado em tempo real
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[240px] bg-zinc-950">
          <img
            src={IMAGE_ASSETS.brasa_geral}
            alt={settings.storeName}
            referrerPolicy="no-referrer"
            className="w-full h-full lg:h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        </div>
      </div>

      {/* Storefront Menu + Order Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Menu Grid (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-white">
              Cardápio de Domingos e Feriados
            </h3>
            <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'espetinho', label: 'Espetinhos' },
                { id: 'bebida', label: 'Refris e Águas' },
                { id: 'combo', label: 'Combos' },
                { id: 'acompanhamento', label: 'Acompanhamentos' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCatFilter(tab.id as 'todos' | ProductCategory)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                    catFilter === tab.id ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activeMenu.map((prod) => {
              const avail = getAvailableStockForProduct(prod);
              const isOut = avail !== null && avail <= 0;
              return (
                <div
                  key={prod.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-zinc-950 overflow-hidden">
                    <img
                      src={IMAGE_ASSETS[prod.imageKey]}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-cover ${isOut ? 'opacity-40 grayscale' : ''}`}
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="capitalize">{prod.category}</span>
                        {avail !== null && (
                          <span className={`font-mono tabular-nums ${isOut ? 'text-red-400' : 'text-zinc-400'}`}>
                            {isOut ? 'Esgotado' : `${avail} disp.`}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-semibold text-zinc-100 mt-0.5">{prod.name}</h4>
                      {prod.description && (
                        <p className="text-xs text-zinc-400 mt-1">{prod.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                      <span className="font-mono text-base font-bold text-white tabular-nums">
                        {formatBRL(prod.price)}
                      </span>
                      <button
                        type="button"
                        disabled={isOut}
                        onClick={() => addToBag(prod)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 whitespace-nowrap shrink-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isOut ? 'Esgotado' : 'Adicionar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Bag / Checkout (4 cols) */}
        <form
          onSubmit={(e) => void handleConfirmClientOrder(e)}
          className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 lg:sticky lg:top-20"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <ShoppingBag className="w-4 h-4 text-orange-500" />
            <h3 className="text-base font-semibold text-white">Seu Pedido</h3>
          </div>

          {lastOrderNumber !== null && (
            <div className="p-3 rounded-lg border border-emerald-900 bg-emerald-950/60 text-xs text-emerald-300">
              Pedido #{lastOrderNumber} confirmado para {formatDateBR(targetDate)}! Estoque atualizado automaticamente.
            </div>
          )}

          {bag.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-lg">
              Escolha os espetinhos e bebidas ao lado para montar seu pedido.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800 max-h-48 overflow-y-auto">
              {bag.map((item) => (
                <div key={item.productId} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-100 truncate">{item.productName}</div>
                    <div className="font-mono text-zinc-400 tabular-nums">
                      {formatBRL(item.subtotal)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateBagQty(item.productId, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-mono font-semibold text-white tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateBagQty(item.productId, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                Para qual Domingo ou Feriado?
              </label>
              <select
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
              >
                {!upcomingDates.some((d) => d.dateStr === targetDate) && (
                  <option value={targetDate}>{formatDateBR(targetDate)}</option>
                )}
                {upcomingDates.map((d) => (
                  <option key={d.dateStr} value={d.dateStr}>
                    {formatDateBR(d.dateStr)} — {d.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              required
              maxLength={80}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Seu nome *"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
            />
            <input
              type="tel"
              maxLength={20}
              value={customerWhatsapp}
              onChange={(e) => setCustomerWhatsapp(e.target.value)}
              placeholder="Seu WhatsApp (DDD + número)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100"
              >
                <option value="retirada">Retirar no local</option>
                <option value="entrega">Entrega</option>
              </select>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as Exclude<PaymentMethod, 'fiado'>)
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100"
              >
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
              </select>
            </div>

            <input
              type="text"
              maxLength={240}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observação (ex.: ponto da carne, troco)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          {orderError && (
            <div className="p-3 rounded-lg border border-red-900 bg-red-950/60 text-xs text-red-300">
              {orderError}
            </div>
          )}

          <div className="pt-3 border-t border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Total do Pedido</span>
              <span className="font-mono text-xl font-bold text-white tabular-nums">
                {formatBRL(bagTotal)}
              </span>
            </div>

            <button
              type="submit"
              disabled={bag.length === 0 || savingOrder}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {savingOrder ? 'Confirmando...' : 'Confirmar Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
