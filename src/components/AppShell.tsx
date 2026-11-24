import React, { useState } from 'react';
import {
  BarChart3,
  Boxes,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  ShoppingBag,
  Store,
  UserCheck,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { ActiveTab, CustomHoliday } from '../types';
import { checkOperatingDay, formatDateBR, getDefaultOperatingDate, toLocalDateString } from '../utils/holidays';

interface Props {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  storeName: string;
  userEmail: string;
  onLogout: () => void;
  onSwitchToClientMode: () => void;
  customHolidays: CustomHoliday[];
  lowStockCount: number;
  openFiadoCount: number;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'painel', label: 'Painel Diário', icon: LayoutDashboard },
  { id: 'pedidos', label: 'Pedidos (Dom/Feriado)', icon: ShoppingBag },
  { id: 'produtos', label: 'Cardápio & Produtos', icon: UtensilsCrossed },
  { id: 'insumos', label: 'Estoque de Insumos', icon: Boxes },
  { id: 'clientes', label: 'Clientes & Fiado', icon: Users },
  { id: 'relatorios', label: 'Lucro Semanal', icon: BarChart3 },
  { id: 'vitrine', label: 'Vitrine do Cliente', icon: Store },
  { id: 'configuracoes', label: 'WhatsApp & Config', icon: MessageCircle },
];

const TAB_TITLES: Record<ActiveTab, string> = {
  painel: 'Painel Financeiro Diário',
  pedidos: 'Pedidos de Domingo & Feriado',
  produtos: 'Produtos & Cardápio',
  insumos: 'Estoque de Insumos',
  clientes: 'Clientes & Fiado',
  relatorios: 'Relatório de Lucro Semanal',
  vitrine: 'Vitrine & Pedido do Cliente',
  configuracoes: 'WhatsApp Automático & Feriados',
};

export const AppShell: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  storeName,
  userEmail,
  onLogout,
  onSwitchToClientMode,
  customHolidays,
  lowStockCount,
  openFiadoCount,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const todayStr = toLocalDateString(new Date());
  const todayInfo = checkOperatingDay(todayStr, customHolidays);
  const nextOperating = getDefaultOperatingDate(customHolidays);

  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Flame className="w-5 h-5 text-orange-500 shrink-0" />
          <span className="font-display text-base font-bold tracking-tight text-white truncate">
            {storeName || 'Brasa de Domingo'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-zinc-400 hover:text-white"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const countHint =
            item.id === 'insumos' && lowStockCount > 0
              ? `${lowStockCount}`
              : item.id === 'clientes' && openFiadoCount > 0
              ? `${openFiadoCount}`
              : null;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-orange-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {countHint && (
                <span
                  className={`font-mono text-xs tabular-nums ${
                    isActive ? 'text-orange-100' : 'text-amber-400'
                  }`}
                >
                  {countHint}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800 space-y-2.5">
        <div className="text-xs text-zinc-400 truncate">{userEmail}</div>
        <button
          type="button"
          onClick={onSwitchToClientMode}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <UserCheck className="w-3.5 h-3.5 text-orange-400" />
          Modo Cliente (Só Pedido)
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sair da conta
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Desktop Sidebar (248px) */}
      <aside className="hidden lg:block w-[248px] shrink-0 border-r border-zinc-800 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-full h-full z-10 border-r border-zinc-800">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-3.5 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display text-lg font-bold text-white truncate whitespace-nowrap">
              {TAB_TITLES[activeTab]}
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 whitespace-nowrap shrink-0">
            <span className={todayInfo.isOperating ? 'text-emerald-400 font-semibold' : 'text-zinc-400'}>
              {todayInfo.isOperating
                ? `Hoje: ${todayInfo.label}`
                : `Hoje fechado · Próximo dia: ${formatDateBR(nextOperating.dateStr)}`}
            </span>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('pedidos')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Pedido
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
