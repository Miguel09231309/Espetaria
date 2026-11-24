import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Edit2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Insumo, InsumoUnit, Order, Product } from '../../types';
import { formatBRL } from '../../utils/format';
import { deleteInsumo, replenishInsumo, saveInsumo } from '../../services/firestoreService';
import { toLocalDateString } from '../../utils/holidays';
import { computeSoldUnitsByInsumo, getProductStockLinks } from '../../utils/stock';

interface Props {
  ownerId: string;
  insumos: Insumo[];
  products: Product[];
  orders: Order[];
}

export const InsumosView: React.FC<Props> = ({ ownerId, insumos, products, orders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'baixos'>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Insumo | null>(null);
  const [replenishTarget, setReplenishTarget] = useState<Insumo | null>(null);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<InsumoUnit>('un');
  const [currentStock, setCurrentStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);

  const [addQty, setAddQty] = useState('');
  const [recordExpense, setRecordExpense] = useState(true);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(toLocalDateString(new Date()));

  const soldByInsumo = useMemo(
    () => computeSoldUnitsByInsumo(orders, products),
    [orders, products]
  );

  const linkedProductsByInsumo = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const prod of products) {
      const links = getProductStockLinks(prod);
      for (const l of links) {
        if (!map[l.insumoId]) map[l.insumoId] = [];
        map[l.insumoId].push(
          l.qtyPerUnit !== 1 ? `${prod.name} (${l.qtyPerUnit}x)` : prod.name
        );
      }
    }
    return map;
  }, [products]);

  const sorted = useMemo(
    () =>
      [...insumos]
        .filter((i) => i.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
        .filter((i) => (statusFilter === 'baixos' ? i.currentStock <= i.minStock : true))
        .sort((a, b) => {
          const aLow = a.currentStock <= a.minStock ? 0 : 1;
          const bLow = b.currentStock <= b.minStock ? 0 : 1;
          return aLow - bLow || a.name.localeCompare(b.name);
        }),
    [insumos, searchTerm, statusFilter]
  );

  const lowCount = useMemo(
    () => insumos.filter((i) => i.currentStock <= i.minStock).length,
    [insumos]
  );

  const totalStockValue = useMemo(
    () => insumos.reduce((acc, i) => acc + i.currentStock * i.unitCost, 0),
    [insumos]
  );

  const openCreate = () => {
    setEditing(null);
    setName('');
    setUnit('un');
    setCurrentStock('0');
    setMinStock('10');
    setUnitCost('0');
    setSupplier('');
    setModalOpen(true);
  };

  const openEdit = (ins: Insumo) => {
    setEditing(ins);
    setName(ins.name);
    setUnit(ins.unit);
    setCurrentStock(String(ins.currentStock));
    setMinStock(String(ins.minStock));
    setUnitCost(String(ins.unitCost));
    setSupplier(ins.supplier);
    setModalOpen(true);
  };

  const openReplenish = (ins: Insumo) => {
    setReplenishTarget(ins);
    setAddQty('10');
    setRecordExpense(true);
    setExpenseAmount(String((10 * ins.unitCost).toFixed(2)));
    setExpenseDate(toLocalDateString(new Date()));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveInsumo(
        ownerId,
        {
          name: name.trim(),
          unit,
          currentStock: Number(currentStock.replace(',', '.')) || 0,
          minStock: Number(minStock.replace(',', '.')) || 0,
          unitCost: Number(unitCost.replace(',', '.')) || 0,
          supplier: supplier.trim(),
        },
        editing?.id
      );
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReplenish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishTarget) return;
    const qty = Number(addQty.replace(',', '.')) || 0;
    if (qty <= 0) return;

    setSaving(true);
    try {
      await replenishInsumo(
        ownerId,
        replenishTarget,
        qty,
        recordExpense,
        expenseDate,
        Number(expenseAmount.replace(',', '.')) || 0
      );
      setReplenishTarget(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Estoque de Insumos
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cada venda realizada no PDV ou na Vitrine do Cliente desconta as unidades automaticamente aqui.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-zinc-400">Valor em estoque</div>
            <div className="font-mono text-sm font-semibold text-white tabular-nums">
              {formatBRL(totalStockValue)}
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo Insumo
          </button>
        </div>
      </div>

      {lowCount > 0 && (
        <div className="bg-amber-950/40 border border-amber-900 rounded-xl p-4 flex items-center gap-3 text-sm text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            <strong>{lowCount}</strong> {lowCount === 1 ? 'insumo precisa' : 'insumos precisam'} de reposição antes do próximo domingo ou feriado.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              statusFilter === 'todos' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({insumos.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('baixos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              statusFilter === 'baixos' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Repor / Esgotado ({lowCount})
          </button>
        </div>

        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar insumo no estoque..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 rounded-lg border border-zinc-800 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-300">Nenhum insumo encontrado.</p>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 text-xs font-medium text-white bg-orange-600 rounded-lg"
            >
              Cadastrar Insumo
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-xs font-medium text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Insumo</th>
                  <th className="px-4 py-3">Produtos Relacionados</th>
                  <th className="px-4 py-3 text-right">Atual</th>
                  <th className="px-4 py-3 text-right">Saídas (Vendas)</th>
                  <th className="px-4 py-3 text-right">Mínimo</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sorted.map((ins) => {
                  const isEmpty = ins.currentStock <= 0;
                  const isLow = ins.currentStock <= ins.minStock;
                  const relatedProds = linkedProductsByInsumo[ins.id] || [];
                  const totalSold = soldByInsumo[ins.id] || 0;

                  return (
                    <tr key={ins.id} className="hover:bg-zinc-800/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-100">{ins.name}</div>
                        <div className="text-xs text-zinc-500">
                          {ins.supplier || 'Sem fornecedor'} · {formatBRL(ins.unitCost)}/{ins.unit}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400 max-w-xs">
                        {relatedProds.length === 0 ? (
                          <span className="text-zinc-500">Uso operacional / geral</span>
                        ) : (
                          <span className="text-zinc-300">{relatedProds.join(', ')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white tabular-nums whitespace-nowrap">
                        {ins.currentStock} {ins.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-orange-400 tabular-nums whitespace-nowrap">
                        -{totalSold} {ins.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400 tabular-nums whitespace-nowrap">
                        {ins.minStock} {ins.unit}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded border whitespace-nowrap ${
                            isEmpty
                              ? 'bg-red-950/60 text-red-300 border-red-900'
                              : isLow
                              ? 'bg-amber-950/60 text-amber-300 border-amber-900'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-900'
                          }`}
                        >
                          {isEmpty ? 'Esgotado' : isLow ? 'Repor estoque' : 'Em dia'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openReplenish(ins)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-md whitespace-nowrap"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            Entrada
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(ins)}
                            className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
                            aria-label={`Editar ${ins.name}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteInsumo(ins.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-red-950/40"
                            aria-label={`Excluir ${ins.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Insumo Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                {editing ? 'Editar Insumo' : 'Novo Insumo'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSave(e)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Nome do insumo</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Carvão Vegetal 5kg"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Unidade</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as InsumoUnit)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="L">Litro (L)</option>
                    <option value="pct">Pacote / Saco (pct)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Custo unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Estoque atual</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Estoque mínimo</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Fornecedor</label>
                <input
                  type="text"
                  maxLength={80}
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ex.: Açougue Bom Corte"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replenish Modal */}
      {replenishTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Entrada de Estoque · {replenishTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setReplenishTarget(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleReplenish(e)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Quantidade comprada ({replenishTarget.unit})
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={addQty}
                  onChange={(e) => {
                    setAddQty(e.target.value);
                    const q = Number(e.target.value) || 0;
                    setExpenseAmount((q * replenishTarget.unitCost).toFixed(2));
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordExpense}
                  onChange={(e) => setRecordExpense(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-orange-600"
                />
                <span>Lançar esta compra como despesa financeira</span>
              </label>

              {recordExpense && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Valor gasto (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Data da compra
                    </label>
                    <input
                      type="date"
                      required
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReplenishTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Confirmando...' : 'Confirmar Entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
