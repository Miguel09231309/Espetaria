import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit2,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  Customer,
  FiadoTransaction,
  Order,
  PaymentMethod,
  StoreSettings,
  WhatsappDispatchPrompt,
} from '../../types';
import {
  formatBRL,
  formatWhatsappDisplay,
  renderFiadoTemplate,
} from '../../utils/format';
import { formatDateBR, toLocalDateString } from '../../utils/holidays';
import {
  addManualFiadoDebit,
  deleteCustomer,
  registerFiadoPayment,
  saveCustomer,
} from '../../services/firestoreService';

interface Props {
  ownerId: string;
  customers: Customer[];
  fiadoTransactions: FiadoTransaction[];
  orders: Order[];
  settings: StoreSettings;
  onTriggerWhatsapp: (prompt: WhatsappDispatchPrompt) => void;
}

export const CustomersFiadoView: React.FC<Props> = ({
  ownerId,
  customers,
  fiadoTransactions,
  orders,
  settings,
  onTriggerWhatsapp,
}) => {
  const [search, setSearch] = useState('');
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [payModalCustomer, setPayModalCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<Exclude<PaymentMethod, 'fiado'>>('pix');
  const [payDesc, setPayDesc] = useState('Pagamento de fiado');
  const [payDate, setPayDate] = useState(toLocalDateString(new Date()));

  const [debitModalCustomer, setDebitModalCustomer] = useState<Customer | null>(null);
  const [debitAmount, setDebitAmount] = useState('');
  const [debitDesc, setDebitDesc] = useState('');
  const [debitDate, setDebitDate] = useState(toLocalDateString(new Date()));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => (onlyDebtors ? c.fiadoBalance > 0 : true))
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.whatsapp.includes(q) ||
          c.neighborhood.toLowerCase().includes(q)
      )
      .sort((a, b) => b.fiadoBalance - a.fiadoBalance || a.name.localeCompare(b.name));
  }, [customers, onlyDebtors, search]);

  const totalFiadoOpen = useMemo(
    () => customers.reduce((acc, c) => acc + c.fiadoBalance, 0),
    [customers]
  );

  const debtorsCount = useMemo(
    () => customers.filter((c) => c.fiadoBalance > 0).length,
    [customers]
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || filtered[0] || null,
    [customers, selectedCustomerId, filtered]
  );

  const selectedHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return fiadoTransactions
      .filter((t) => t.customerId === selectedCustomer.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [fiadoTransactions, selectedCustomer]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setWhatsapp('');
    setNeighborhood('');
    setNotes('');
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setWhatsapp(c.whatsapp);
    setNeighborhood(c.neighborhood);
    setNotes(c.notes);
    setFormOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const id = await saveCustomer(
        ownerId,
        { name: name.trim(), whatsapp: whatsapp.trim(), neighborhood: neighborhood.trim(), notes: notes.trim() },
        editing?.id
      );
      setSelectedCustomerId(id);
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerCobrar = (c: Customer) => {
    const message = renderFiadoTemplate(settings.fiadoTemplate, {
      customerName: c.name,
      balance: c.fiadoBalance,
      settings,
    });
    onTriggerWhatsapp({
      customerName: c.name,
      customerId: c.id,
      whatsapp: c.whatsapp,
      orderId: '',
      type: 'cobranca_fiado',
      message,
      title: `Cobrar Fiado via WhatsApp · ${c.name}`,
    });
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalCustomer) return;
    const numeric = Number(payAmount.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    setSaving(true);
    try {
      await registerFiadoPayment({
        ownerId,
        customer: payModalCustomer,
        amount: numeric,
        paymentMethod: payMethod,
        description: payDesc.trim(),
        date: payDate || toLocalDateString(new Date()),
        pendingOrders: orders,
      });
      setPayModalCustomer(null);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDebit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debitModalCustomer) return;
    const numeric = Number(debitAmount.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    setSaving(true);
    try {
      await addManualFiadoDebit({
        ownerId,
        customer: debitModalCustomer,
        amount: numeric,
        description: debitDesc.trim() || 'Lançamento manual na caderneta',
        date: debitDate || toLocalDateString(new Date()),
      });
      setDebitModalCustomer(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Clientes & Caderneta de Fiado
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {customers.length} clientes cadastrados · {debtorsCount} com saldo de fiado ({formatBRL(totalFiadoOpen)} a receber)
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Cliente
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
          <button
            type="button"
            onClick={() => setOnlyDebtors(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              !onlyDebtors ? 'bg-orange-600 text-white' : 'text-zinc-400'
            }`}
          >
            Todos os Clientes
          </button>
          <button
            type="button"
            onClick={() => setOnlyDebtors(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              onlyDebtors ? 'bg-orange-600 text-white' : 'text-zinc-400'
            }`}
          >
            Com Fiado em Aberto ({debtorsCount})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, WhatsApp ou bairro..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 rounded-lg border border-zinc-700 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-400">
              Nenhum cliente encontrado com esse filtro.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filtered.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-orange-950/30' : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-zinc-100">{c.name}</div>
                      <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="font-mono tabular-nums">
                          {c.whatsapp ? formatWhatsappDisplay(c.whatsapp) : 'Sem WhatsApp'}
                        </span>
                        {c.neighborhood && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{c.neighborhood}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{c.ordersCount} pedidos</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-zinc-400">Fiado</div>
                        <div
                          className={`font-mono text-sm font-semibold tabular-nums ${
                            c.fiadoBalance > 0 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {formatBRL(c.fiadoBalance)}
                        </div>
                      </div>

                      {c.fiadoBalance > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerCobrar(c);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Cobrar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
          {selectedCustomer ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {selectedCustomer.name}
                  </h3>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {selectedCustomer.whatsapp
                      ? formatWhatsappDisplay(selectedCustomer.whatsapp)
                      : 'Sem WhatsApp cadastrado'}
                    {selectedCustomer.neighborhood ? ` · ${selectedCustomer.neighborhood}` : ''}
                  </div>
                  {selectedCustomer.notes && (
                    <p className="text-xs text-zinc-400 mt-1.5">{selectedCustomer.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(selectedCustomer)}
                    className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
                    aria-label="Editar cliente"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteCustomer(selectedCustomer.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-red-950/40"
                    aria-label="Excluir cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950">
                  <div className="text-xs text-zinc-400">Saldo Fiado Atual</div>
                  <div
                    className={`font-mono text-xl font-bold tabular-nums mt-0.5 ${
                      selectedCustomer.fiadoBalance > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatBRL(selectedCustomer.fiadoBalance)}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950">
                  <div className="text-xs text-zinc-400">Total já Comprado</div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums mt-0.5">
                    {formatBRL(selectedCustomer.totalSpent)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedCustomer.fiadoBalance > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPayModalCustomer(selectedCustomer);
                        setPayAmount(String(selectedCustomer.fiadoBalance.toFixed(2)));
                        setPayMethod('pix');
                        setPayDesc('Quitação de fiado');
                        setPayDate(toLocalDateString(new Date()));
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Receber Pagamento
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerCobrar(selectedCustomer)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Cobrar no WhatsApp
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDebitModalCustomer(selectedCustomer);
                    setDebitAmount('');
                    setDebitDesc('');
                    setDebitDate(toLocalDateString(new Date()));
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 whitespace-nowrap"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Lançar Fiado Avulso
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="text-xs font-semibold text-zinc-300">
                  Histórico da Caderneta
                </div>
                {selectedHistory.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3">
                    Nenhum lançamento de fiado registrado para este cliente.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-800 max-h-64 overflow-y-auto">
                    {selectedHistory.map((tx) => (
                      <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-100 truncate">{tx.description}</div>
                          <div className="text-zinc-400 tabular-nums">
                            {formatDateBR(tx.date)} · {tx.type === 'debito' ? 'Fiado anotado' : `Pago (${tx.paymentMethod})`}
                          </div>
                        </div>
                        <span
                          className={`font-mono font-semibold tabular-nums shrink-0 ${
                            tx.type === 'debito' ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {tx.type === 'debito' ? '+' : '-'}
                          {formatBRL(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-zinc-400">
              Selecione um cliente ao lado para visualizar o saldo de fiado e o histórico.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Customer Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                {editing ? 'Editar Cliente' : 'Cadastrar Cliente'}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="p-1.5 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSaveCustomer(e)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Nome completo</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  WhatsApp (com DDD)
                </label>
                <input
                  type="tel"
                  required
                  maxLength={20}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex.: 11999998888"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Bairro / Referência</label>
                <input
                  type="text"
                  maxLength={80}
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Observações</label>
                <input
                  type="text"
                  maxLength={200}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: Dia combinado para acerto, preferência"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
      {payModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Receber Fiado · {payModalCustomer.name}
              </h3>
              <button type="button" onClick={() => setPayModalCustomer(null)} className="p-1.5 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleConfirmPayment(e)} className="p-6 space-y-4">
              <div className="text-xs text-zinc-400">
                Saldo em aberto:{' '}
                <strong className="font-mono text-amber-400 tabular-nums">
                  {formatBRL(payModalCustomer.fiadoBalance)}
                </strong>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={payModalCustomer.fiadoBalance}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Forma</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as Exclude<PaymentMethod, 'fiado'>)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="pix">Pix</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Descrição</label>
                <input
                  type="text"
                  maxLength={160}
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalCustomer(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Registrando...' : 'Confirmar Recebimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Fiado Debit Modal */}
      {debitModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Lançar Fiado Avulso · {debitModalCustomer.name}
              </h3>
              <button type="button" onClick={() => setDebitModalCustomer(null)} className="p-1.5 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleConfirmDebit(e)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={debitAmount}
                    onChange={(e) => setDebitAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={debitDate}
                    onChange={(e) => setDebitDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Motivo / Itens</label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={debitDesc}
                  onChange={(e) => setDebitDesc(e.target.value)}
                  placeholder="Ex.: Saldo anterior ou pedido anotado fora do caixa"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDebitModalCustomer(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-700 rounded-lg hover:bg-amber-800 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Adicionar à Caderneta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
