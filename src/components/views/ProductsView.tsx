import React, { useMemo, useState } from 'react';
import { Edit2, Link2, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import {
  ImageKey,
  Insumo,
  Order,
  Product,
  ProductCategory,
  StockComponent,
} from '../../types';
import { formatBRL } from '../../utils/format';
import { IMAGE_ASSETS } from '../../data/seedData';
import {
  deleteProduct,
  saveProduct,
  syncCompleteCatalogAndStockLinks,
  toggleProductActive,
} from '../../services/firestoreService';
import {
  computeProductAvailableUnits,
  computeSoldUnitsByProduct,
  getProductStockLinks,
} from '../../utils/stock';

interface Props {
  ownerId: string;
  products: Product[];
  insumos: Insumo[];
  orders: Order[];
}

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  espetinho: 'Espetinho',
  bebida: 'Bebida (Refri / Água)',
  acompanhamento: 'Acompanhamento',
  combo: 'Combo',
};

export const ProductsView: React.FC<Props> = ({ ownerId, products, insumos, orders }) => {
  const [filterCat, setFilterCat] = useState<'todos' | ProductCategory>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('espetinho');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [insumoQtyPerUnit, setInsumoQtyPerUnit] = useState('1');
  const [autoCreateInsumo, setAutoCreateInsumo] = useState(true);
  const [initialStock, setInitialStock] = useState('30');
  const [extraInsumos, setExtraInsumos] = useState<StockComponent[]>([]);
  const [imageKey, setImageKey] = useState<ImageKey>('espetinho_carne');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const soldByProduct = useMemo(() => computeSoldUnitsByProduct(orders), [orders]);

  const filtered = useMemo(
    () =>
      products
        .filter((p) => filterCat === 'todos' || p.category === filterCat)
        .filter((p) =>
          p.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
        )
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [products, filterCat, searchTerm]
  );

  const unlinkedCount = useMemo(
    () => products.filter((p) => getProductStockLinks(p).length === 0).length,
    [products]
  );

  const handleSyncCatalog = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncCompleteCatalogAndStockLinks(ownerId);
      localStorage.setItem(`brasa_catalog_v2_${ownerId}`, 'done');
      if (res.addedProducts === 0 && res.addedInsumos === 0 && res.linkedProducts === 0) {
        setSyncFeedback('Todos os produtos e vínculos de estoque já estão completos e relacionados.');
      } else {
        setSyncFeedback(
          `Catálogo atualizado: +${res.addedProducts} produto(s), +${res.addedInsumos} insumo(s) e ${res.linkedProducts} vínculo(s) ajustado(s).`
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCategory('espetinho');
    setPrice('');
    setCostPrice('');
    setInsumoId('');
    setInsumoQtyPerUnit('1');
    setAutoCreateInsumo(true);
    setInitialStock('30');
    setExtraInsumos([]);
    setImageKey('espetinho_carne');
    setDescription('');
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setCategory(p.category);
    setPrice(String(p.price));
    setCostPrice(String(p.costPrice));
    setInsumoId(p.insumoId);
    setInsumoQtyPerUnit(String(p.insumoQtyPerUnit || 1));
    setAutoCreateInsumo(!p.insumoId);
    setInitialStock('20');
    setExtraInsumos(p.extraInsumos || []);
    setImageKey(p.imageKey);
    setDescription(p.description);
    setActive(p.active);
    setModalOpen(true);
  };

  const addExtraRow = () => {
    const firstAvailable = insumos.find(
      (i) => i.id !== insumoId && !extraInsumos.some((e) => e.insumoId === i.id)
    );
    if (!firstAvailable) return;
    setExtraInsumos((prev) => [...prev, { insumoId: firstAvailable.id, qtyPerUnit: 1 }]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveProduct(
        ownerId,
        {
          name: name.trim(),
          category,
          price: Number(price.replace(',', '.')) || 0,
          costPrice: Number(costPrice.replace(',', '.')) || 0,
          insumoId,
          insumoQtyPerUnit: Number(insumoQtyPerUnit.replace(',', '.')) || 1,
          extraInsumos,
          active,
          imageKey,
          description: description.trim(),
        },
        editing?.id,
        !insumoId && autoCreateInsumo
          ? {
              enabled: true,
              initialStock: Number(initialStock.replace(',', '.')) || 0,
              minStock: 10,
              unit: 'un',
              supplier: 'Estoque Padrão',
            }
          : undefined
      );
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Cardápio & Registro de Produtos
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {products.length} produtos cadastrados. Todos ligados ao estoque para dar baixa automática após cada venda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleSyncCatalog()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Completar Catálogo & Vincular Estoque'}
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Produto
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3.5 rounded-xl border border-emerald-900 bg-emerald-950/50 text-xs text-emerald-300 flex items-center justify-between gap-3">
          <span>{syncFeedback}</span>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {unlinkedCount > 0 && (
        <div className="p-3.5 rounded-xl border border-amber-900 bg-amber-950/40 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <span>
            <strong>{unlinkedCount}</strong> produto(s) ainda sem vínculo de estoque. Clique ao lado para criar e vincular automaticamente.
          </span>
          <button
            type="button"
            onClick={() => void handleSyncCatalog()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-700 rounded-lg hover:bg-amber-800"
          >
            <Link2 className="w-3.5 h-3.5" />
            Vincular Agora
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'espetinho', label: 'Espetinhos' },
            { id: 'bebida', label: 'Refris e Águas' },
            { id: 'acompanhamento', label: 'Acompanhamentos' },
            { id: 'combo', label: 'Combos' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterCat(tab.id as 'todos' | ProductCategory)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filterCat === tab.id ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 rounded-lg border border-zinc-800 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-zinc-300">
              Nenhum produto encontrado nesta categoria.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 text-xs font-medium text-white bg-orange-600 rounded-lg"
            >
              Adicionar Produto
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-xs font-medium text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Baixa no Estoque (por venda)</th>
                  <th className="px-4 py-3 text-right">Disp.</th>
                  <th className="px-4 py-3 text-right">Vendidos</th>
                  <th className="px-4 py-3 text-right">Venda</th>
                  <th className="px-4 py-3 text-right">Lucro Unit.</th>
                  <th className="px-4 py-3">Vitrine</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((p) => {
                  const links = getProductStockLinks(p);
                  const avail = computeProductAvailableUnits(p, insumos);
                  const soldQty = soldByProduct[p.id] || 0;
                  const profit = p.price - p.costPrice;

                  return (
                    <tr key={p.id} className="hover:bg-zinc-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={IMAGE_ASSETS[p.imageKey]}
                            alt={p.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover border border-zinc-700 shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-zinc-100">{p.name}</div>
                            {p.description && (
                              <div className="text-xs text-zinc-400 max-w-xs truncate">
                                {p.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                        {CATEGORY_LABELS[p.category]}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {links.length === 0 ? (
                          <span className="text-amber-400">Sem vínculo</span>
                        ) : (
                          <div className="space-y-0.5">
                            {links.map((l) => {
                              const ins = insumos.find((i) => i.id === l.insumoId);
                              return (
                                <div key={l.insumoId} className="truncate max-w-[230px]">
                                  <span className="font-mono text-zinc-300">{l.qtyPerUnit}x</span>{' '}
                                  {ins ? ins.name : 'Insumo'}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                        {avail === null ? (
                          <span className="text-zinc-500">—</span>
                        ) : (
                          <span
                            className={
                              avail <= 0
                                ? 'text-red-400 font-semibold'
                                : avail <= 10
                                ? 'text-amber-400 font-semibold'
                                : 'text-emerald-400 font-semibold'
                            }
                          >
                            {avail} un
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                        {soldQty} un
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white tabular-nums whitespace-nowrap">
                        {formatBRL(p.price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400 tabular-nums whitespace-nowrap">
                        {formatBRL(profit)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void toggleProductActive(p.id, !p.active)}
                          className={`text-xs font-medium px-2.5 py-1 rounded border whitespace-nowrap shrink-0 ${
                            p.active
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-900'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {p.active ? 'Ativo' : 'Pausado'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
                            aria-label={`Editar ${p.name}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteProduct(p.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-red-950/40"
                            aria-label={`Excluir ${p.name}`}
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

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                {editing ? 'Editar Produto' : 'Cadastrar Produto'}
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
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nome do produto
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Espetinho de Picanha / Coca-Cola 2L"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="espetinho">Espetinho</option>
                    <option value="bebida">Bebida (Refri / Água)</option>
                    <option value="acompanhamento">Acompanhamento</option>
                    <option value="combo">Combo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Foto na vitrine</label>
                  <select
                    value={imageKey}
                    onChange={(e) => setImageKey(e.target.value as ImageKey)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="espetinho_carne">Espetos de Carne / Frango</option>
                    <option value="linguica_coracao">Linguiça / Coração</option>
                    <option value="bebidas_geladas">Refris e Águas Geladas</option>
                    <option value="brasa_geral">Brasa / Queijo / Combo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Preço de Venda (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Custo Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Primary Stock Link */}
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950/60 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Insumo principal (baixa na venda)
                    </label>
                    <select
                      value={insumoId}
                      onChange={(e) => {
                        setInsumoId(e.target.value);
                        if (e.target.value) setAutoCreateInsumo(false);
                      }}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">Criar insumo automático / Sem seleção</option>
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (Est.: {i.currentStock} {i.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Qtd/venda</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={insumoQtyPerUnit}
                      onChange={(e) => setInsumoQtyPerUnit(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono tabular-nums text-zinc-100 focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {!insumoId && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-800">
                    <label className="flex items-center gap-2 text-xs text-emerald-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCreateInsumo}
                        onChange={(e) => setAutoCreateInsumo(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-950 text-orange-600"
                      />
                      <span>Criar insumo no estoque com este nome</span>
                    </label>
                    {autoCreateInsumo && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-400">Estoque inicial:</span>
                        <input
                          type="number"
                          min="0"
                          value={initialStock}
                          onChange={(e) => setInitialStock(e.target.value)}
                          className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-zinc-100"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Extra Insumos (Combos / Multiple items) */}
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-400">
                      Componentes extras (ideal para combos: ex.: + 1 refri)
                    </span>
                    <button
                      type="button"
                      onClick={addExtraRow}
                      className="text-xs font-medium text-orange-400 hover:underline"
                    >
                      + Adicionar componente
                    </button>
                  </div>
                  {extraInsumos.map((row, idx) => (
                    <div key={`${row.insumoId}-${idx}`} className="flex items-center gap-2">
                      <select
                        value={row.insumoId}
                        onChange={(e) =>
                          setExtraInsumos((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, insumoId: e.target.value } : item
                            )
                          )
                        }
                        className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
                      >
                        {insumos.map((ins) => (
                          <option key={ins.id} value={ins.id}>
                            {ins.name} ({ins.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={row.qtyPerUnit}
                        onChange={(e) =>
                          setExtraInsumos((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, qtyPerUnit: Number(e.target.value) || 0 }
                                : item
                            )
                          )
                        }
                        className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs font-mono text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setExtraInsumos((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-zinc-500 hover:text-red-400"
                        aria-label="Remover componente"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Descrição para o cardápio
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: Acompanha farofa temperada e limão"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-orange-600"
                />
                <span>Disponível para venda e visível na vitrine do cliente</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
