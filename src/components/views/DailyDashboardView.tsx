import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  ShoppingBag,
  Receipt,
  Check,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  CustomHoliday,
  Customer,
  DailyExpense,
  ExpenseCategory,
  Insumo,
  Order,
  Product,
} from '../../types';
import {
  checkOperatingDay,
  formatDateBR,
  getOperatingDateOptions,
} from '../../utils/holidays';
import { formatBRL } from '../../utils/format';
import {
  addDailyExpense,
  deleteDailyExpense,
  updateExpenseDate,
  updateOrderDate,
} from '../../services/firestoreService';
import { computeSoldUnitsByInsumo } from '../../utils/stock';

interface Props {
  ownerId: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  orders: Order[];
  expenses: DailyExpense[];
  insumos: Insumo[];
  products: Product[];
  customers: Customer[];
  customHolidays: CustomHoliday[];
  onNavigate: (tab: ActiveTab) => void;
}

const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  carvao: 'Carvão',
  insumos: 'Insumos extras',
  gelo: 'Gelo',
  gas: 'Gás / Utensílios',
  outros: 'Outros',
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  fiado: 'Fiado (Caderneta)',
};

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  na_brasa: 'Na Brasa',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const DailyDashboardView: React.FC<Props> = ({
  ownerId,
  selectedDate,
  onSelectDate,
  orders,
  expenses,
  insumos,
  products,
  customers,
  customHolidays,
  onNavigate,
}) => {
  const [expDesc, setExpDesc] = useState('');
  const [expCat, setExpCat] = useState<ExpenseCategory>('carvao');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(selectedDate);
  const [savingExp, setSavingExp] = useState(false);

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderDate, setEditingOrderDate] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingExpenseDate, setEditingExpenseDate] = useState('');

  const operatingOptions = useMemo(
    () => getOperatingDateOptions(customHolidays, 35, 28),
    [customHolidays]
  );

  const dayInfo = useMemo(
    () => checkOperatingDay(selectedDate, customHolidays),
    [selectedDate, customHolidays]
  );

  const dayOrders = useMemo(
    () =>
      orders
        .filter((o) => o.saleDate === selectedDate && o.orderStatus !== 'cancelado')
        .sort((a, b) => b.orderNumber - a.orderNumber),
    [orders, selectedDate]
  );

  const dayExpenses = useMemo(
    () => expenses.filter((e) => e.date === selectedDate),
    [expenses, selectedDate]
  );

  const metrics = useMemo(() => {
    const grossRevenue = dayOrders.reduce((acc, o) => acc + o.total, 0);
    const receivedCash = dayOrders
      .filter((o) => o.paymentMethod !== 'fiado')
      .reduce((acc, o) => acc + o.total, 0);
    const fiadoCreatedToday = dayOrders
      .filter((o) => o.paymentMethod === 'fiado')
      .reduce((acc, o) => acc + o.total, 0);
    const cogs = dayOrders.reduce((acc, o) => acc + o.estimatedCost, 0);
    const extraExpenses = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossRevenue - cogs - extraExpenses;
    const margin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    const byPayment: Record<string, number> = { pix: 0, dinheiro: 0, cartao: 0, fiado: 0 };
    const byCategory: Record<string, { qty: number; revenue: number }> = {
      espetinho: { qty: 0, revenue: 0 },
      bebida: { qty: 0, revenue: 0 },
      acompanhamento: { qty: 0, revenue: 0 },
      combo: { qty: 0, revenue: 0 },
    };

    for (const o of dayOrders) {
      byPayment[o.paymentMethod] = (byPayment[o.paymentMethod] || 0) + o.total;
      for (const item of o.items) {
        if (!byCategory[item.category]) {
          byCategory[item.category] = { qty: 0, revenue: 0 };
        }
        byCategory[item.category].qty += item.quantity;
        byCategory[item.category].revenue += item.subtotal;
      }
    }

    return {
      grossRevenue,
      receivedCash,
      fiadoCreatedToday,
      cogs,
      extraExpenses,
      netProfit,
      margin,
      byPayment,
      byCategory,
    };
  }, [dayOrders, dayExpenses]);

  const lowStockInsumos = useMemo(
    () => insumos.filter((i) => i.currentStock <= i.minStock),
    [insumos]
  );

  const totalOpenFiado = useMemo(
    () => customers.reduce((acc, c) => acc + c.fiadoBalance, 0),
    [customers]
  );

  const dayStockDeductions = useMemo(() => {
    const map = computeSoldUnitsByInsumo(dayOrders, products);
    return Object.entries(map)
      .map(([insumoId, qty]) => {
        const ins = insumos.find((i) => i.id === insumoId);
        return {
          insumoId,
          name: ins?.name || 'Insumo',
          unit: ins?.unit || 'un',
          qty,
          remaining: ins?.currentStock ?? 0,
        };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [dayOrders, products, insumos]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(expAmount.replace(',', '.'));
    if (!expDesc.trim() || !Number.isFinite(numeric) || numeric <= 0) return;

    setSavingExp(true);
    try {
      await addDailyExpense(ownerId, {
        date: expDate || selectedDate,
        description: expDesc.trim(),
        category: expCat,
        amount: numeric,
      });
      setExpDesc('');
      setExpAmount('');
    } finally {
      setSavingExp(false);
    }
  };

  const handleSaveOrderDate = async (order: Order) => {
    if (!editingOrderDate) return;
    await updateOrderDate(ownerId, order, editingOrderDate, customHolidays, true);
    setEditingOrderId(null);
  };

  const handleSaveExpenseDate = async (expenseId: string) => {
    if (!editingExpenseDate) return;
    await updateExpenseDate(expenseId, editingExpenseDate);
    setEditingExpenseId(null);
  };

  return (
    <div className="space-y-6">
      {/* Operating Day Selector Strip */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Calendar className="w-3.5 h-3.5 text-orange-500" />
            <span>Dia de operação selecionado</span>
            <span aria-hidden="true">·</span>
            <span className={dayInfo.isOperating ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
              {dayInfo.label}
            </span>
          </div>
          <h2 className="font-display text-xl font-bold text-white">
            Controle Financeiro de {formatDateBR(selectedDate)}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Escolher domingo ou feriado"
            value={selectedDate}
            onChange={(e) => {
              onSelectDate(e.target.value);
              setExpDate(e.target.value);
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
          >
            {!operatingOptions.some((o) => o.dateStr === selectedDate) && (
              <option value={selectedDate}>{formatDateBR(selectedDate)} (Selecionado)</option>
            )}
            {operatingOptions.map((opt) => (
              <option key={opt.dateStr} value={opt.dateStr}>
                {formatDateBR(opt.dateStr)} — {opt.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            aria-label="Modificar data do painel"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                onSelectDate(e.target.value);
                setExpDate(e.target.value);
              }
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100 focus:border-orange-500 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => onNavigate('pedidos')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Registrar Pedido
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Faturamento do Dia</span>
            <ShoppingBag className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="font-mono text-2xl font-semibold text-white tabular-nums">
            {formatBRL(metrics.grossRevenue)}
          </div>
          <div className="text-xs text-zinc-400 tabular-nums">
            {dayOrders.length} {dayOrders.length === 1 ? 'pedido válido' : 'pedidos válidos'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Entrou no Caixa (À Vista)</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
            {formatBRL(metrics.receivedCash)}
          </div>
          <div className="text-xs text-zinc-400 tabular-nums">
            Fiado hoje: {formatBRL(metrics.fiadoCreatedToday)}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Custo + Despesas do Dia</span>
            <Receipt className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-2xl font-semibold text-white tabular-nums">
            {formatBRL(metrics.cogs + metrics.extraExpenses)}
          </div>
          <div className="text-xs text-zinc-400 tabular-nums">
            Insumos {formatBRL(metrics.cogs)} · Extras {formatBRL(metrics.extraExpenses)}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Lucro Líquido Estimado</span>
            <TrendingUp className="w-4 h-4 text-orange-500" />
          </div>
          <div
            className={`font-mono text-2xl font-semibold tabular-nums ${
              metrics.netProfit >= 0 ? 'text-white' : 'text-red-400'
            }`}
          >
            {formatBRL(metrics.netProfit)}
          </div>
          <div className="text-xs text-zinc-400 tabular-nums">
            Margem líquida: {metrics.margin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Main Split: Breakdown + Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
            <h3 className="text-base font-semibold text-white">
              Resumo de Entradas e Categorias
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-xs font-medium text-zinc-400">Por forma de pagamento</div>
                <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg bg-zinc-950/60">
                  {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-zinc-300">{label}</span>
                      <span className="font-mono font-medium text-white tabular-nums">
                        {formatBRL(metrics.byPayment[key] || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-medium text-zinc-400">Por categoria vendida</div>
                <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg bg-zinc-950/60">
                  {[
                    { key: 'espetinho', label: 'Espetinhos' },
                    { key: 'bebida', label: 'Refris e Águas' },
                    { key: 'combo', label: 'Combos' },
                    { key: 'acompanhamento', label: 'Acompanhamentos' },
                  ].map((cat) => {
                    const row = metrics.byCategory[cat.key] || { qty: 0, revenue: 0 };
                    return (
                      <div key={cat.key} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                        <span className="text-zinc-300">
                          {cat.label}{' '}
                          <span className="text-xs text-zinc-500 tabular-nums">({row.qty} un)</span>
                        </span>
                        <span className="font-mono font-medium text-white tabular-nums">
                          {formatBRL(row.revenue)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Pedidos do dia {formatDateBR(selectedDate)}
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('pedidos')}
                className="text-xs font-medium text-orange-400 hover:underline whitespace-nowrap shrink-0"
              >
                Abrir fila de pedidos
              </button>
            </div>

            {dayOrders.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-zinc-300">
                  Nenhum pedido registrado nesta data ainda.
                </p>
                <p className="text-xs text-zinc-500">
                  Use o botão Registrar Pedido para lançar vendas de balcão, retirada ou entrega.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-950/60 border-b border-zinc-800 text-xs font-medium text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Pedido</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Pagamento</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {dayOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-zinc-800/40">
                        <td className="px-4 py-3 font-mono font-medium text-white tabular-nums">
                          #{ord.orderNumber}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          <div className="font-medium text-zinc-100">{ord.customerName}</div>
                          <div className="text-xs text-zinc-500">
                            {ord.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {editingOrderId === ord.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={editingOrderDate}
                                onChange={(e) => setEditingOrderDate(e.target.value)}
                                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-zinc-100"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveOrderDate(ord)}
                                className="p-1 text-emerald-400 hover:bg-zinc-800 rounded"
                                aria-label="Confirmar data"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingOrderId(null)}
                                className="p-1 text-zinc-400 hover:bg-zinc-800 rounded"
                                aria-label="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOrderId(ord.id);
                                setEditingOrderDate(ord.saleDate);
                              }}
                              className="font-mono text-zinc-400 hover:text-orange-400 underline underline-offset-2 tabular-nums"
                              title="Clique para modificar a data"
                            >
                              {formatDateBR(ord.saleDate)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">
                          {PAYMENT_LABELS[ord.paymentMethod] || ord.paymentMethod}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-zinc-300">
                          {STATUS_LABELS[ord.orderStatus] || ord.orderStatus}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-white tabular-nums">
                          {formatBRL(ord.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Daily Expenses + Alerts */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Despesas Extras do Dia</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Carvão, gelo, gás ou compras rápidas descontadas do lucro do dia.
              </p>
            </div>

            <form onSubmit={(e) => void handleAddExpense(e)} className="space-y-3">
              <div>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Ex.: 2 sacos de carvão + gelo"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <select
                  value={expCat}
                  onChange={(e) => setExpCat(e.target.value as ExpenseCategory)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 focus:border-orange-500 focus:outline-none"
                >
                  {Object.entries(EXPENSE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs font-mono text-zinc-100 focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="R$ 0,00"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm font-mono tabular-nums text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={savingExp}
                className="w-full py-2 px-4 text-sm font-medium text-white bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {savingExp ? 'Salvando...' : 'Lançar Despesa'}
              </button>
            </form>

            {dayExpenses.length > 0 && (
              <div className="divide-y divide-zinc-800 border-t border-zinc-800 pt-2">
                {dayExpenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between py-2.5 gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-100 truncate">{exp.description}</div>
                      <div className="text-xs text-zinc-400 flex items-center gap-2">
                        <span>{EXPENSE_LABELS[exp.category] || exp.category}</span>
                        <span aria-hidden="true">·</span>
                        {editingExpenseId === exp.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="date"
                              value={editingExpenseDate}
                              onChange={(e) => setEditingExpenseDate(e.target.value)}
                              className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[11px] font-mono text-zinc-100"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveExpenseDate(exp.id)}
                              className="text-emerald-400"
                              aria-label="Salvar data da despesa"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingExpenseId(null)}
                              className="text-zinc-400"
                              aria-label="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpenseId(exp.id);
                              setEditingExpenseDate(exp.date);
                            }}
                            className="font-mono hover:text-orange-400 underline underline-offset-2 tabular-nums"
                          >
                            {formatDateBR(exp.date)}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm font-medium text-red-400 tabular-nums">
                        -{formatBRL(exp.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void deleteDailyExpense(exp.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-800"
                        aria-label="Excluir despesa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Atenção Rápida</h3>

            <div className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-800 bg-zinc-950">
              <div>
                <div className="text-xs text-zinc-400">Total em Fiado a Receber</div>
                <div className="font-mono text-lg font-semibold text-amber-400 tabular-nums">
                  {formatBRL(totalOpenFiado)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 whitespace-nowrap shrink-0"
              >
                Cobrar no WhatsApp
              </button>
            </div>

            {dayStockDeductions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
                  <span>Baixas de estoque hoje</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('insumos')}
                    className="text-orange-400 hover:underline"
                  >
                    Ver tudo
                  </button>
                </div>
                <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg bg-zinc-950/60">
                  {dayStockDeductions.slice(0, 5).map((row) => (
                    <div key={row.insumoId} className="flex items-center justify-between px-3.5 py-2 text-xs">
                      <span className="text-zinc-200 truncate">{row.name}</span>
                      <span className="font-mono tabular-nums shrink-0 ml-2">
                        <span className="text-orange-400">-{row.qty} {row.unit}</span>
                        <span className="text-zinc-500"> · restam {row.remaining}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lowStockInsumos.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{lowStockInsumos.length} insumos abaixo do mínimo</span>
                </div>
                <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg bg-zinc-950/60">
                  {lowStockInsumos.slice(0, 4).map((ins) => (
                    <div key={ins.id} className="flex items-center justify-between px-3.5 py-2 text-xs">
                      <span className="font-medium text-zinc-200">{ins.name}</span>
                      <span className="font-mono text-red-400 tabular-nums">
                        {ins.currentStock} / {ins.minStock} {ins.unit}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('insumos')}
                  className="text-xs font-medium text-orange-400 hover:underline"
                >
                  Repor estoque de insumos
                </button>
              </div>
            ) : (
              <p className="text-xs text-emerald-400">
                Todos os insumos estão acima do estoque mínimo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
