import React, { useState } from 'react';
import { Calendar, Check, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { CustomHoliday, StoreSettings, WhatsappLog } from '../../types';
import { formatDateBR, getBrazilianNationalHolidays } from '../../utils/holidays';
import { buildWhatsAppLink, formatWhatsappDisplay } from '../../utils/format';
import {
  addCustomHoliday,
  deleteCustomHoliday,
  saveStoreSettings,
} from '../../services/firestoreService';

interface Props {
  ownerId: string;
  settings: StoreSettings;
  customHolidays: CustomHoliday[];
  whatsappLogs: WhatsappLog[];
}

const LOG_TYPE_LABELS: Record<WhatsappLog['type'], string> = {
  confirmacao_pedido: 'Confirmação de Pedido',
  pedido_pronto: 'Pedido Pronto',
  cobranca_fiado: 'Cobrança de Fiado',
  comunicado: 'Comunicado',
};

export const SettingsWhatsappView: React.FC<Props> = ({
  ownerId,
  settings,
  customHolidays,
  whatsappLogs,
}) => {
  const [form, setForm] = useState({
    storeName: settings.storeName,
    ownerWhatsapp: settings.ownerWhatsapp,
    pixKey: settings.pixKey,
    address: settings.address,
    operatingHours: settings.operatingHours,
    customerNotice: settings.customerNotice,
    confirmTemplate: settings.confirmTemplate,
    readyTemplate: settings.readyTemplate,
    fiadoTemplate: settings.fiadoTemplate,
  });
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);

  const currentYear = new Date().getFullYear();
  const nationalHolidays = Object.entries(getBrazilianNationalHolidays(currentYear)).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveStoreSettings(ownerId, form);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) return;
    setAddingHoliday(true);
    try {
      await addCustomHoliday(ownerId, holidayDate, holidayName.trim());
      setHolidayDate('');
      setHolidayName('');
    } finally {
      setAddingHoliday(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            WhatsApp Automático, Feriados & Configurações
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Personalize os textos automáticos de cobrança e avisos, cadastre feriados da sua cidade e edite os dados da barraca.
          </p>
        </div>
        {savedToast && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-900 px-3 py-1.5 rounded-lg">
            <Check className="w-4 h-4" />
            Configurações salvas
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={(e) => void handleSave(e)}
          className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5"
        >
          <h3 className="text-base font-semibold text-white border-b border-zinc-800 pb-3">
            Dados da Barraca & Mensagens Automáticas
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Nome da barraca / espetinho
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Seu WhatsApp (para receber pedidos)
              </label>
              <input
                type="tel"
                maxLength={20}
                value={form.ownerWhatsapp}
                onChange={(e) => setForm({ ...form, ownerWhatsapp: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Chave Pix</label>
              <input
                type="text"
                maxLength={100}
                value={form.pixKey}
                onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Horário de funcionamento
              </label>
              <input
                type="text"
                maxLength={60}
                value={form.operatingHours}
                onChange={(e) => setForm({ ...form, operatingHours: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Endereço</label>
            <input
              type="text"
              maxLength={160}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Recado exibido na Vitrine do Cliente
            </label>
            <textarea
              rows={2}
              maxLength={280}
              value={form.customerNotice}
              onChange={(e) => setForm({ ...form, customerNotice: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          <div className="pt-2 border-t border-zinc-800 space-y-4">
            <div className="text-xs text-zinc-400">
              Variáveis automáticas:{' '}
              <span className="font-mono text-zinc-200">
                {'{cliente}'} {'{pedido}'} {'{itens}'} {'{total}'} {'{data}'} {'{pagamento}'} {'{saldo}'} {'{pix}'} {'{loja}'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Modelo — Notificação de Pedido Confirmado
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={form.confirmTemplate}
                onChange={(e) => setForm({ ...form, confirmTemplate: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Modelo — Pedido Pronto para Retirada / Entrega
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={form.readyTemplate}
                onChange={(e) => setForm({ ...form, readyTemplate: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Modelo — Cobrança Automática de Fiado
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={form.fiadoTemplate}
                onChange={(e) => setForm({ ...form, fiadoTemplate: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              <h3 className="text-base font-semibold text-white">
                Feriados Municipais / Especiais
              </h3>
            </div>
            <p className="text-xs text-zinc-400">
              Todos os domingos e feriados nacionais já liberam vendas automaticamente. Cadastre abaixo feriados da sua cidade ou datas extras.
            </p>

            <form onSubmit={(e) => void handleAddHoliday(e)} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-100"
                />
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="Nome do feriado"
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <button
                type="submit"
                disabled={addingHoliday}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Liberar Data como Feriado
              </button>
            </form>

            {customHolidays.length > 0 && (
              <div className="divide-y divide-zinc-800 border-t border-zinc-800 pt-2">
                {customHolidays.map((h) => (
                  <div key={h.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-semibold text-zinc-100 tabular-nums">
                        {formatDateBR(h.date)}
                      </span>{' '}
                      <span className="text-zinc-400">· {h.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteCustomHoliday(h.id)}
                      className="p-1 text-zinc-500 hover:text-red-400"
                      aria-label="Remover feriado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <details className="pt-2 border-t border-zinc-800">
              <summary className="text-xs font-medium text-zinc-300 cursor-pointer">
                Ver feriados nacionais já incluídos ({currentYear})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1 text-xs text-zinc-400">
                {nationalHolidays.map(([d, n]) => (
                  <div key={d} className="flex justify-between">
                    <span>{n}</span>
                    <span className="font-mono tabular-nums">{formatDateBR(d)}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">
                Histórico de Mensagens WhatsApp
              </h3>
            </div>

            {whatsappLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4">
                Quando você enviar notificações ou cobranças de fiado pelo WhatsApp, o histórico aparecerá aqui.
              </p>
            ) : (
              <div className="divide-y divide-zinc-800 max-h-80 overflow-y-auto">
                {whatsappLogs.slice(0, 15).map((log) => (
                  <div key={log.id} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-zinc-100">{log.customerName}</span>
                      <span className="text-zinc-400">{LOG_TYPE_LABELS[log.type]}</span>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 whitespace-pre-line">
                      {log.message}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span className="font-mono tabular-nums">
                        {log.whatsapp ? formatWhatsappDisplay(log.whatsapp) : 'Sem número'}
                      </span>
                      <a
                        href={buildWhatsAppLink(log.whatsapp, log.message)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-emerald-400 hover:underline"
                      >
                        Reenviar
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
