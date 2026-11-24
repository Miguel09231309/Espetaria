import React, { useState } from 'react';
import { Calendar, Flame, LogIn, ShoppingBag, MessageCircle, ShieldCheck, UserCheck } from 'lucide-react';
import { IMAGE_ASSETS, PUBLIC_PREVIEW_PRODUCTS } from '../data/seedData';
import { checkOperatingDay, formatDateBR, getDefaultOperatingDate, toLocalDateString } from '../utils/holidays';
import { formatBRL } from '../utils/format';

export type AccessRole = 'owner' | 'client';

interface Props {
  onLogin: (role: AccessRole) => Promise<void>;
  authError: string | null;
  loggingIn: boolean;
}

export const AuthGate: React.FC<Props> = ({ onLogin, authError, loggingIn }) => {
  const [showPublicMenu, setShowPublicMenu] = useState(false);

  const todayStr = toLocalDateString(new Date());
  const todayInfo = checkOperatingDay(todayStr, []);
  const nextOperating = getDefaultOperatingDate([]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <div className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span>Brasa de Domingo</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <button
              type="button"
              onClick={() => setShowPublicMenu(false)}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                !showPublicMenu ? 'text-white underline underline-offset-4' : ''
              }`}
            >
              Acesso do Sistema
            </button>
            <button
              type="button"
              onClick={() => setShowPublicMenu(true)}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                showPublicMenu ? 'text-white underline underline-offset-4' : ''
              }`}
            >
              Ver Cardápio
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void onLogin('client')}
              disabled={loggingIn}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <UserCheck className="w-4 h-4" />
              Entrar como Cliente
            </button>
            <button
              type="button"
              onClick={() => void onLogin('owner')}
              disabled={loggingIn}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              {loggingIn ? 'Conectando...' : 'Entrar como Dono'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
        {!showPublicMenu ? (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                <div className="text-xs font-medium text-zinc-400 flex flex-wrap items-center gap-2">
                  <span>Exclusivo para Domingos e Feriados</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-orange-400">
                    {todayInfo.isOperating
                      ? `Hoje aberto (${todayInfo.label})`
                      : `Próxima operação: ${formatDateBR(nextOperating.dateStr)} (${nextOperating.label})`}
                  </span>
                </div>

                <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-white text-balance leading-[1.1]">
                  Controle de espetinho feito para o ritmo de domingo e feriado
                </h1>

                <p className="text-base text-zinc-400 leading-relaxed max-w-xl">
                  Entre como Dono para gerenciar pedidos, estoque de insumos, fiado, WhatsApp e lucro semanal — ou entre como Cliente para fazer pedidos com baixa automática no estoque.
                </p>

                {authError && (
                  <div className="p-3.5 rounded-lg border border-red-900 bg-red-950/60 text-sm text-red-300">
                    {authError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => void onLogin('owner')}
                    disabled={loggingIn}
                    className="inline-flex items-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                  >
                    <LogIn className="w-4 h-4" />
                    {loggingIn ? 'Entrando...' : 'Entrar como Dono (Painel Completo)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onLogin('client')}
                    disabled={loggingIn}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-zinc-100 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                  >
                    <ShoppingBag className="w-4 h-4 text-orange-400" />
                    Entrar como Cliente (Só Pedido)
                  </button>
                </div>

                <div className="pt-4 border-t border-zinc-800 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-zinc-100">Tudo integrado</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Pedido baixa o estoque na hora</div>
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100">Datas flexíveis</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Edite datas de pedidos e feriados</div>
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100">Lucro Semanal</div>
                    <div className="text-xs text-zinc-400 mt-0.5">Receita menos insumos e gastos</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="relative h-full min-h-[340px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                  <img
                    src={IMAGE_ASSETS.brasa_geral}
                    alt="Espetinhos de carne e queijo coalho assando na brasa"
                    referrerPolicy="no-referrer"
                    className="w-full h-full lg:h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 text-white space-y-1">
                    <div className="text-xs font-medium text-orange-400">
                      Operação focada · Domingos e Feriados
                    </div>
                    <div className="font-display text-xl font-semibold">
                      Espetinhos, refrigerantes, águas e combos integrados em tempo real
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                <h2 className="text-sm font-semibold text-zinc-100">Calendário Domingos & Feriados</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Feriados nacionais calculados, feriados personalizados e edição de datas nos pedidos.
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
                <h2 className="text-sm font-semibold text-zinc-100">Estoque Ligado ao Pedido</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Cada compra feita pelo cliente ou no caixa diminui os insumos e atualiza o lucro na hora.
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Cobrança Fiado WhatsApp</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Caderneta de fiado integrada com disparo rápido de cobrança pelo WhatsApp.
                </p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-2">
                <ShieldCheck className="w-5 h-5 text-zinc-200" />
                <h2 className="text-sm font-semibold text-zinc-100">Modo Cliente Restrito</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Acesso separado para o cliente visualizar o cardápio e fazer somente o pedido.
                </p>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="space-y-1">
                <div className="text-xs font-medium text-orange-400">
                  Cardápio · Domingos e Feriados
                </div>
                <h1 className="font-display text-2xl font-bold text-white">
                  Pré-visualização do Cardápio
                </h1>
                <p className="text-sm text-zinc-400">
                  Entre como Cliente para montar seu pedido com estoque em tempo real.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onLogin('client')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-4 h-4" />
                Entrar como Cliente e Pedir
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {PUBLIC_PREVIEW_PRODUCTS.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-zinc-950 overflow-hidden">
                    <img
                      src={IMAGE_ASSETS[item.imageKey]}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="text-xs text-zinc-400 capitalize">{item.category}</div>
                      <h3 className="text-base font-semibold text-zinc-100 mt-0.5">{item.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{item.description}</p>
                    </div>
                    <div className="pt-2 font-mono text-base font-semibold text-white tabular-nums">
                      {formatBRL(item.price)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
