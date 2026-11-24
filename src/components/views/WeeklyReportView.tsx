import React, { useMemo } from 'react';
import { Download, MessageCircle, TrendingUp } from 'lucide-react';
import { DailyExpense, FiadoTransaction, Order } from '../../types';
import {
  formatDateBR,
  formatShortDateBR,
  getWeekEndSaturday,
  getWeekStartSunday,
} from '../../utils/holidays';
import { buildWhatsAppLink, formatBRL } from '../../utils/format';

interface Props {
  orders: Order[];
  expenses: DailyExpense[];
  fiadoTransactions: FiadoTransaction[];
  ownerWhatsapp: string;
  storeName: string;
}

interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  ordersCount: number;
  grossRevenue: number;
  cashReceived: number;
  fiadoGenerated: number;
  fiadoCollected: number;
  cogs: number;
  extraExpenses: number;
  netProfit: number;
  margin: number;
}

export const WeeklyReportView: React.FC<Props> = ({
  orders,
  expenses,
  fiadoTransactions,
  ownerWhatsapp,
  storeName,
}) => {
  const weeks = useMemo<WeekSummary[]>(() => {
    const map = new Map<string, WeekSummary>();

    const ensureWeek = (dateStr: string): WeekSummary => {
      const ws = getWeekStartSunday(dateStr);
      let row = map.get(ws);
      if (!row) {
        row = {
          weekStart: ws,
          weekEnd: getWeekEndSaturday(ws),
          ordersCount: 0,
          grossRevenue: 0,
          cashReceived: 0,
          fiadoGenerated: 0,
          fiadoCollected: 0,
          cogs: 0,
          extraExpenses: 0,
          netProfit: 0,
          margin: 0,
        };
        map.set(ws, row);
      }
      return row;
    };

    for (const o of orders) {
      if (o.orderStatus === 'cancelado') continue;
      const w = ensureWeek(o.saleDate);
      w.ordersCount += 1;
      w.grossRevenue += o.total;
      if (o.paymentMethod === 'fiado') {
        w.fiadoGenerated += o.total;
      } else {
        w.cashReceived += o.total;
      }
      w.cogs += o.estimatedCost;
    }

    for (const e of expenses) {
      const w = ensureWeek(e.date);
      w.extraExpenses += e.amount;
    }

    for (const tx of fiadoTransactions) {
      if (tx.type === 'pagamento') {
        const w = ensureWeek(tx.date);
        w.fiadoCollected += tx.amount;
      }
    }

    const list = Array.from(map.values()).map((w) => {
      const netProfit = w.grossRevenue - w.cogs - w.extraExpenses;
      const margin = w.grossRevenue > 0 ? (netProfit / w.grossRevenue) * 100 : 0;
      return {
        ...w,
        netProfit,
        margin,
      };
    });

    return list.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [orders, expenses, fiadoTransactions]);

  const totals = useMemo(() => {
    return weeks.reduce(
      (acc, w) => ({
        revenue: acc.revenue + w.grossRevenue,
        costs: acc.costs + w.cogs + w.extraExpenses,
        profit: acc.profit + w.netProfit,
        orders: acc.orders + w.ordersCount,
      }),
      { revenue: 0, costs: 0, profit: 0, orders: 0 }
    );
  }, [weeks]);

  const chartWeeks = useMemo(() => [...weeks].slice(0, 6).reverse(), [weeks]);
  const maxBarValue = useMemo(() => {
    const peak = chartWeeks.reduce((m, w) => Math.max(m, w.grossRevenue, w.cogs + w.extraExpenses), 100);
    return Math.ceil(peak * 1.15);
  }, [chartWeeks]);

  const handleExportCSV = () => {
    const headers = [
      'Inicio Semana (Dom)',
      'Fim Semana (Sab)',
      'Pedidos',
      'Faturamento Bruto',
      'Recebido na Hora',
      'Fiado Gerado',
      'Fiado Recebido',
      'Custo Produtos',
      'Despesas Extras',
      'Lucro Liquido',
      'Margem (%)',
    ];
    const rows = weeks.map((w) => [
      formatDateBR(w.weekStart),
      formatDateBR(w.weekEnd),
      w.ordersCount,
      w.grossRevenue.toFixed(2),
      w.cashReceived.toFixed(2),
      w.fiadoGenerated.toFixed(2),
      w.fiadoCollected.toFixed(2),
      w.cogs.toFixed(2),
      w.extraExpenses.toFixed(2),
      w.netProfit.toFixed(2),
      w.margin.toFixed(1),
    ]);

    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-lucro-semanal.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const latestWeek = weeks[0];
  const weeklyWhatsappText = latestWeek
    ? `Resumo Semanal — ${storeName} (${formatShortDateBR(latestWeek.weekStart)} a ${formatShortDateBR(
        latestWeek.weekEnd
      )})\nPedidos: ${latestWeek.ordersCount}\nFaturamento: ${formatBRL(
        latestWeek.grossRevenue
      )}\nCustos + Despesas: ${formatBRL(
        latestWeek.cogs + latestWeek.extraExpenses
      )}\nLucro Líquido: ${formatBRL(latestWeek.netProfit)} (${latestWeek.margin.toFixed(1)}%)`
    : '';

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Relatório de Lucro Semanal
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Consolidado semana a semana (Domingo a Sábado) somando vendas de domingo, feriados, custos de insumos e despesas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {latestWeek && (
            <a
              href={buildWhatsAppLink(ownerWhatsapp, weeklyWhatsappText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-900 rounded-lg hover:bg-emerald-900/50 whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar Resumo no WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={weeks.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Overall Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-1">
          <div className="text-xs text-zinc-400">Semanas Registradas</div>
          <div className="font-mono text-2xl font-semibold text-white tabular-nums">
            {weeks.length}
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">{totals.orders} pedidos no período</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-1">
          <div className="text-xs text-zinc-400">Faturamento Acumulado</div>
          <div className="font-mono text-2xl font-semibold text-white tabular-nums">
            {formatBRL(totals.revenue)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-1">
          <div className="text-xs text-zinc-400">Custos + Despesas</div>
          <div className="font-mono text-2xl font-semibold text-amber-400 tabular-nums">
            {formatBRL(totals.costs)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-1">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span>Lucro Líquido Total</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
            {formatBRL(totals.profit)}
          </div>
        </div>
      </div>

      {/* SVG Weekly Comparison Chart */}
      {chartWeeks.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-white">
              Evolução Semanal: Faturamento vs Custos vs Lucro Líquido
            </h3>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-zinc-200 inline-block" /> Faturamento
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" /> Custos + Despesas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" /> Lucro Líquido
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <div className="min-w-[540px] h-56 flex items-end justify-around gap-4 pt-6 pb-2 border-b border-zinc-800">
              {chartWeeks.map((w) => {
                const revH = Math.max(4, Math.round((w.grossRevenue / maxBarValue) * 160));
                const costH = Math.max(4, Math.round(((w.cogs + w.extraExpenses) / maxBarValue) * 160));
                const profH = Math.max(4, Math.round((Math.max(0, w.netProfit) / maxBarValue) * 160));
                return (
                  <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-2">
                    <div className="flex items-end gap-1.5 h-44">
                      <div
                        title={`Faturamento: ${formatBRL(w.grossRevenue)}`}
                        style={{ height: `${revH}px` }}
                        className="w-5 bg-zinc-200 rounded-t"
                      />
                      <div
                        title={`Custos + Despesas: ${formatBRL(w.cogs + w.extraExpenses)}`}
                        style={{ height: `${costH}px` }}
                        className="w-5 bg-amber-500 rounded-t"
                      />
                      <div
                        title={`Lucro: ${formatBRL(w.netProfit)}`}
                        style={{ height: `${profH}px` }}
                        className="w-5 bg-emerald-500 rounded-t"
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium text-zinc-200 font-mono tabular-nums">
                        {formatShortDateBR(w.weekStart)}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-400 tabular-nums">
                        {formatBRL(w.netProfit)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Weekly Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {weeks.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-400">
            Lance pedidos de domingo ou feriado para gerar os relatórios semanais automaticamente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-xs font-medium text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Semana (Dom–Sáb)</th>
                  <th className="px-4 py-3 text-right">Pedidos</th>
                  <th className="px-4 py-3 text-right">Faturamento</th>
                  <th className="px-4 py-3 text-right">Recebido Hora</th>
                  <th className="px-4 py-3 text-right">Fiado Gerado</th>
                  <th className="px-4 py-3 text-right">Fiado Recebido</th>
                  <th className="px-4 py-3 text-right">Custos + Extras</th>
                  <th className="px-4 py-3 text-right">Lucro Líquido</th>
                  <th className="px-4 py-3 text-right">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {weeks.map((w) => (
                  <tr key={w.weekStart} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-100 tabular-nums">
                      {formatDateBR(w.weekStart)} — {formatShortDateBR(w.weekEnd)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-300">
                      {w.ordersCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-white tabular-nums">
                      {formatBRL(w.grossRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300 tabular-nums">
                      {formatBRL(w.cashReceived)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400 tabular-nums">
                      {formatBRL(w.fiadoGenerated)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400 tabular-nums">
                      {formatBRL(w.fiadoCollected)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400 tabular-nums">
                      {formatBRL(w.cogs + w.extraExpenses)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${
                        w.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatBRL(w.netProfit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-400 tabular-nums">
                      {w.margin.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
