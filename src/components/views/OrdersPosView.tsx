import React, { useMemo, useState } from 'react';
import {
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Flame,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import {
  CustomHoliday,
  Customer,
  DeliveryType,
  Insumo,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductCategory,
  StoreSettings,
  WhatsappDispatchPrompt,
} from '../../types';
import {
  checkOperatingDay,
  formatDateBR,
  getOperatingDateOptions,
} from '../../utils/holidays';
import {
  formatBRL,
  renderOrderTemplate,
} from '../../utils/format';
import {
  cancelOrderAtomic,
  createOrderAtomic,
  updateOrderDate,
  updateOrderStatus,
} from '../../services/firestoreService';
import { computeProductAvailableUnits, getProductStockLinks } from '../../utils/stock';

interface Props {
  ownerId: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  products: Product[];
  insumos: Insumo[];
  customers: Customer[];
  orders: Order[];
  customHolidays: CustomHoliday[];
  settings: StoreSettings;
  onTriggerWhatsapp: (prompt: WhatsappDispatchPrompt) => void;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  fiado: 'Fiado',
};

const DELIVERY_LABELS: Record<DeliveryType, string> = {
  balcao: 'Balcão',
  retirada: 'Retirada',
  entrega: 'Entrega',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  na_brasa: 'Na Brasa',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const OrdersPosView: React.FC<Props> = ({
  ownerId,
  selectedDate,
  onSelectDate,
  products,
  insumos,
  customers,
  orders,
  customHolidays,
  settings,
  onTriggerWhatsapp,
}) => {
  const [catFilter, setCatFilter] = useState<'todos' | ProductCategory>('todos');
  const [searchProd, setSearchProd] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInWhatsapp, setWalkInWhatsapp] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('balcao');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'todos'>('ativos');

  const [editingDateOrderId, setEditingDateOrderId] = useState<string | null>(null);
  const [editingDateVal, setEditingDateVal] = useState('');
  const [allowHolidayUnlock, setAllowHolidayUnlock] = useState(true);

  const dayInfo = useMemo(
    () => checkOperatingDay(selectedDate, customHolidays),
    [selectedDate, customHolidays]
  );

  const operatingOptions = useMemo(
    () => getOperatingDateOptions(customHolidays, 21, 35),
    [customHolidays]
  );

  const activeProducts = useMemo(
    () =>
      products
        .filter((p) => p.active)
        .filter((p) => catFilter === 'todos' || p.category === catFilter)
        .filter((p) =>
          p.name.toLowerCase().includes(searchProd.trim().toLowerCase())
        ),
    [products, catFilter, searchProd]
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const nextOrderNumber = useMemo(() => {
    const maxNum = orders.reduce((m, o) => Math.max(m, o.orderNumber || 0), 100);
    return maxNum + 1;
  }, [orders]);

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.subtotal, 0),
    [cart]
  );
  const numericDiscount = Math.max(0, Number(discount.replace(',', '.')) || 0);
  const total = Math.max(0, subtotal - numericDiscount);

  const getAvailableStockForProduct = (prod: Product): number | null => {
    return computeProductAvailableUnits(prod, insumos, cart, products);
  };

  const addProductToCart = (prod: Product) => {
    setFormError(null);
    setOrderSuccessMsg(null);
    const avail = getAvailableStockForProduct(prod);
    if (avail !== null && avail <= 0) {
      setFormError(`Estoque esgotado para ${prod.name}.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === prod.id
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
          productId: prod.id,
          productName: prod.name,
          category: prod.category,
          quantity: 1,
          unitPrice: prod.price,
          unitCost: prod.costPrice,
          subtotal: prod.price,
          insumoId: prod.insumoId,
          insumoQtyPerUnit: prod.insumoQtyPerUnit,
          ...(prod.extraInsumos && prod.extraInsumos.length > 0
            ? { extraInsumos: prod.extraInsumos }
            : {}),
        },
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setFormError(null);
    if (delta > 0) {
      const prod = products.find((p) => p.id === productId);
      if (prod) {
        const avail = getAvailableStockForProduct(prod);
        if (avail !== null && avail <= 0) {
          setFormError(`Estoque insuficiente para adicionar mais ${prod.name}.`);
          return;
        }
      }
    }
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...item,
            quantity: nextQty,
            subtotal: Number((nextQty * item.unitPrice).toFixed(2)),
          };
        })
        .filter((x): x is OrderItem => x !== null)
    );
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!dayInfo.isOperating) {
      setFormError(
        'Vendas bloqueadas em dias úteis. Selecione um domingo ou feriado cadastrado.'
      );
      return;
    }
    if (cart.length === 0) {
      setFormError('Adicione pelo menos um espetinho ou bebida ao pedido.');
      return;
    }
    if (paymentMethod === 'fiado' && !selectedCustomer) {
      setFormError(
        'Para vender no Fiado, selecione um cliente cadastrado para lançar na caderneta.'
      );
      return;
    }

    const finalCustomerName = selectedCustomer
      ? selectedCustomer.name
      : walkInName.trim() || 'Cliente Balcão';
    const finalWhatsapp = selectedCustomer
      ? selectedCustomer.whatsapp
      : walkInWhatsapp.trim();

    setSubmitting(true);
    setOrderSuccessMsg(null);
    try {
      const confirmedNumber = nextOrderNumber;
      await createOrderAtomic({
        ownerId,
        orderNumber: confirmedNumber,
        saleDate: selectedDate,
        customHolidays,
        customer: selectedCustomer,
        existingCustomers: customers,
        customerName: finalCustomerName,
        customerWhatsapp: finalWhatsapp,
        deliveryType,
        items: cart,
        discount: numericDiscount,
        paymentMethod,
        orderStatus: 'confirmado',
        notes,
        insumos,
        products,
      });

      // Confirmar pedido sem abrir modal de mensagem; estoque já descontado na transação
      setOrderSuccessMsg(
        `Pedido #${confirmedNumber} confirmado! Unidades descontadas automaticamente do estoque.`
      );
      setCart([]);
      setDiscount('');
      setNotes('');
      setWalkInName('');
      setWalkInWhatsapp('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao registrar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const dayOrders = useMemo(() => {
    return orders
      .filter((o) => o.saleDate === selectedDate)
      .filter((o) => (statusFilter === 'ativos' ? o.orderStatus !== 'cancelado' : true))
      .sort((a, b) => b.orderNumber - a.orderNumber);
  }, [orders, selectedDate, statusFilter]);

  const handleStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    await updateOrderStatus(order, nextStatus);
  };

  const handleSaveOrderDate = async (order: Order) => {
    if (!editingDateVal) return;
    setFormError(null);
    try {
      await updateOrderDate(ownerId, order, editingDateVal, customHolidays, allowHolidayUnlock);
      setEditingDateOrderId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao alterar data.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Operating Day Verification Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Calendar className="w-3.5 h-3.5 text-orange-500" />
            <span>Agenda exclusiva de Domingos e Feriados</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                dayInfo.isOperating
                  ? 'text-emerald-400 font-medium'
                  : 'text-red-400 font-medium'
              }
            >
              {dayInfo.label}
            </span>
          </div>
          <h2 className="font-display text-xl font-bold text-white">
            PDV & Gestão de Pedidos — {formatDateBR(selectedDate)}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Selecionar domingo ou feriado"
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
          >
            {!operatingOptions.some((o) => o.dateStr === selectedDate) && (
              <option value={selectedDate}>{formatDateBR(selectedDate)}</option>
            )}
            {operatingOptions.map((opt) => (
              <option key={opt.dateStr} value={opt.dateStr}>
                {formatDateBR(opt.dateStr)} — {opt.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="Modificar data de venda"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) onSelectDate(e.target.value);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {!dayInfo.isOperating && (
        <div className="bg-red-950/50 border border-red-900 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Ban className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-200">
                Vendas bloqueadas nesta data ({formatDateBR(selectedDate)})
              </h3>
              <p className="text-xs text-red-300 mt-0.5">
                O sistema permite lançar pedidos apenas em domingos e feriados. Escolha um domingo/feriado acima ou cadastre esta data como feriado municipal em WhatsApp & Config.
              </p>
            </div>
          </div>
          {operatingOptions[0] && (
            <button
              type="button"
              onClick={() => onSelectDate(operatingOptions[0].dateStr)}
              className="px-4 py-2 text-xs font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 whitespace-nowrap shrink-0"
            >
              Ir para Domingo / Feriado válido
            </button>
          )}
        </div>
      )}

      {/* PDV Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Product Picker (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-lg overflow-x-auto">
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
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    catFilter === tab.id
                      ? 'bg-orange-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 rounded-lg border border-zinc-700 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {activeProducts.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">
              Nenhum produto ativo encontrado nesta categoria.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeProducts.map((prod) => {
                const links = getProductStockLinks(prod);
                const linkedInsumo = insumos.find((i) => i.id === prod.insumoId);
                const avail = getAvailableStockForProduct(prod);
                const isOut = avail !== null && avail <= 0;
                const inCart = cart.find((c) => c.productId === prod.id);

                return (
                  <button
                    key={prod.id}
                    type="button"
                    disabled={!dayInfo.isOperating || isOut}
                    onClick={() => addProductToCart(prod)}
                    className="text-left p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/60 hover:border-orange-500 hover:bg-zinc-800/60 transition-colors flex items-center justify-between gap-3 disabled:opacity-45"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">
                        {prod.name}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {prod.category}
                        {(links.length > 0 || linkedInsumo) && avail !== null && (
                          <>
                            {' · '}
                            <span className={`tabular-nums ${isOut ? 'text-red-400 font-medium' : 'text-zinc-300'}`}>
                              {isOut
                                ? 'Esgotado'
                                : `Disp.: ${avail} ${links.length > 1 ? 'un' : linkedInsumo?.unit || 'un'}`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-semibold text-white tabular-nums">
                        {formatBRL(prod.price)}
                      </div>
                      {inCart && (
                        <div className="text-xs font-medium text-orange-400 tabular-nums">
                          {inCart.quantity} no pedido
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart & Checkout Form (5 cols) */}
        <form
          onSubmit={(e) => void handleSubmitOrder(e)}
          className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-orange-500" />
              <h3 className="text-base font-semibold text-white">
                Novo Pedido #{nextOrderNumber}
              </h3>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs text-zinc-400 hover:text-red-400"
              >
                Limpar itens
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              Clique nos espetinhos e bebidas ao lado para montar o pedido.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800 max-h-56 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100 truncate">
                      {item.productName}
                    </div>
                    <div className="text-xs text-zinc-400 font-mono tabular-nums">
                      {formatBRL(item.unitPrice)} cada
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.productId, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                      aria-label={`Remover 1 ${item.productName}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-semibold text-white tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.productId, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                      aria-label={`Adicionar 1 ${item.productName}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-16 text-right font-mono text-sm font-medium text-white tabular-nums">
                      {formatBRL(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Customer selection */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800">
            <div>
              <label htmlFor="pdv-customer" className="block text-xs font-medium text-zinc-300 mb-1">
                Cliente (obrigatório para Fiado)
              </label>
              <select
                id="pdv-customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
              >
                <option value="">Cliente avulso / Balcão</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.fiadoBalance > 0 ? `(Fiado: ${formatBRL(c.fiadoBalance)})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {!selectedCustomer && (
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  maxLength={80}
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="Nome (opcional)"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="tel"
                  maxLength={20}
                  value={walkInWhatsapp}
                  onChange={(e) => setWalkInWhatsapp(e.target.value)}
                  placeholder="WhatsApp (opcional)"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Tipo</label>
                <select
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                >
                  <option value="balcao">Balcão</option>
                  <option value="retirada">Retirada</option>
                  <option value="entrega">Entrega</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                >
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                  <option value="fiado">Fiado (Caderneta)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="Desconto (R$)"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
              />
              <input
                type="text"
                maxLength={240}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Obs. (ex: ponto da carne)"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {orderSuccessMsg && (
            <div className="p-3 rounded-lg border border-emerald-900 bg-emerald-950/60 text-xs text-emerald-300">
              {orderSuccessMsg}
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-lg border border-red-900 bg-red-950/60 text-xs text-red-300">
              {formError}
            </div>
          )}

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-400">Total do Pedido</div>
              <div className="font-mono text-2xl font-bold text-white tabular-nums">
                {formatBRL(total)}
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || !dayInfo.isOperating || cart.length === 0}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Confirmar Pedido'}
            </button>
          </div>
        </form>
      </div>

      {/* Active Order Queue for Selected Date */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Fila de Pedidos · {formatDateBR(selectedDate)}
            </h3>
            <p className="text-xs text-zinc-400">
              Altere status, modifique a data do pedido ou envie WhatsApp quando desejar.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => setStatusFilter('ativos')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                statusFilter === 'ativos'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400'
              }`}
            >
              Válidos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                statusFilter === 'todos'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400'
              }`}
            >
              Incluir Cancelados
            </button>
          </div>
        </div>

        {dayOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            Nenhum pedido lançado para {formatDateBR(selectedDate)}.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {dayOrders.map((order) => (
              <div
                key={order.id}
                className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-zinc-800/30"
              >
                <div className="space-y-1 min-w-[240px]">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono font-bold text-white tabular-nums">
                      #{order.orderNumber}
                    </span>
                    <span className="font-semibold text-zinc-100">{order.customerName}</span>
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <span className="text-xs text-zinc-400">
                      {DELIVERY_LABELS[order.deliveryType]}
                    </span>
                    <span className="text-zinc-600" aria-hidden="true">·</span>
                    <span
                      className={`text-xs font-medium ${
                        order.paymentStatus === 'pago'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {PAYMENT_LABELS[order.paymentMethod]} (
                      {order.paymentStatus === 'pago' ? 'Pago' : 'Fiado em aberto'})
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(' · ')}
                  </div>
                  {order.notes && (
                    <div className="text-xs text-zinc-500">Obs.: {order.notes}</div>
                  )}

                  {/* Inline Date Modifier */}
                  {editingDateOrderId === order.id ? (
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={editingDateVal}
                        onChange={(e) => setEditingDateVal(e.target.value)}
                        className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-mono text-zinc-100"
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <input
                          type="checkbox"
                          checked={allowHolidayUnlock}
                          onChange={(e) => setAllowHolidayUnlock(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-950 text-orange-600"
                        />
                        Liberar como feriado se for dia útil
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleSaveOrderDate(order)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 rounded hover:bg-emerald-800"
                      >
                        <Check className="w-3 h-3" /> Salvar Data
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDateOrderId(null)}
                        className="p-1 text-zinc-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    order.orderStatus !== 'cancelado' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDateOrderId(order.id);
                          setEditingDateVal(order.saleDate);
                        }}
                        className="text-[11px] text-zinc-500 hover:text-orange-400 underline underline-offset-2"
                      >
                        Modificar data ({formatDateBR(order.saleDate)})
                      </button>
                    )
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right mr-2">
                    <div className="font-mono text-base font-semibold text-white tabular-nums">
                      {formatBRL(order.total)}
                    </div>
                    <div className="text-xs text-zinc-400">
                      Status: <strong className="text-zinc-100">{STATUS_LABELS[order.orderStatus]}</strong>
                    </div>
                  </div>

                  {order.orderStatus !== 'cancelado' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {order.orderStatus !== 'na_brasa' && order.orderStatus !== 'pronto' && order.orderStatus !== 'entregue' && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(order, 'na_brasa')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-300 bg-orange-950/60 border border-orange-900 rounded-lg hover:bg-orange-900/50 whitespace-nowrap shrink-0"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          Na Brasa
                        </button>
                      )}
                      {order.orderStatus !== 'pronto' && order.orderStatus !== 'entregue' && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(order, 'pronto')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-900 rounded-lg hover:bg-emerald-900/50 whitespace-nowrap shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pronto
                        </button>
                      )}
                      {order.orderStatus !== 'entregue' && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(order, 'entregue')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 whitespace-nowrap shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Entregue
                        </button>
                      )}
                      {order.customerWhatsapp && (
                        <button
                          type="button"
                          onClick={() => {
                            const tpl =
                              order.orderStatus === 'pronto'
                                ? settings.readyTemplate
                                : settings.confirmTemplate;
                            const msg = renderOrderTemplate(tpl, {
                              customerName: order.customerName,
                              orderNumber: order.orderNumber,
                              items: order.items,
                              total: order.total,
                              saleDateBR: formatDateBR(order.saleDate),
                              paymentLabel: PAYMENT_LABELS[order.paymentMethod],
                              settings,
                            });
                            onTriggerWhatsapp({
                              customerName: order.customerName,
                              customerId: order.customerId,
                              whatsapp: order.customerWhatsapp,
                              orderId: order.id,
                              type:
                                order.orderStatus === 'pronto'
                                  ? 'pedido_pronto'
                                  : 'confirmacao_pedido',
                              message: msg,
                              title: `Notificar Pedido #${order.orderNumber}`,
                            });
                          }}
                          className="p-2 text-emerald-400 border border-zinc-700 bg-zinc-950 rounded-lg hover:bg-zinc-800"
                          title="Enviar mensagem no WhatsApp"
                          aria-label="Enviar mensagem no WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void cancelOrderAtomic(order, insumos, customers, products)}
                        className="p-2 text-zinc-500 hover:text-red-400 border border-zinc-700 bg-zinc-950 rounded-lg hover:bg-red-950/40"
                        title="Cancelar pedido e devolver estoque"
                        aria-label="Cancelar pedido"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
