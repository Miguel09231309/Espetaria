import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import { WhatsappDispatchPrompt } from '../types';
import { buildWhatsAppLink, formatWhatsappDisplay } from '../utils/format';

interface Props {
  prompt: WhatsappDispatchPrompt | null;
  onClose: () => void;
  onConfirmLog: (editedMessage: string) => Promise<void>;
}

export const WhatsappDispatchModal: React.FC<Props> = ({ prompt, onClose, onConfirmLog }) => {
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prompt) {
      setMessage(prompt.message);
      setCopied(false);
    }
  }, [prompt]);

  if (!prompt) return null;

  const waUrl = buildWhatsAppLink(prompt.whatsapp, message);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored in restricted clipboard contexts
    }
  };

  const handleSentClick = async () => {
    setSaving(true);
    try {
      await onConfirmLog(message);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
    >
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 id="wa-modal-title" className="text-base font-semibold text-zinc-100">
              {prompt.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Fechar janela de WhatsApp"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-100">{prompt.customerName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {prompt.whatsapp ? formatWhatsappDisplay(prompt.whatsapp) : 'Sem número cadastrado'}
            </span>
          </div>

          <div>
            <label htmlFor="wa-message-editor" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Mensagem pronta para WhatsApp
            </label>
            <textarea
              id="wa-message-editor"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar texto'}
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSentClick}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {saving ? 'Registrando...' : 'Apenas registrar'}
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void handleSentClick()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
                Enviar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
