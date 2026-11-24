import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Erro inesperado no sistema.' };
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Ocorreu uma falha ao sincronizar os dados.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `Permissão ou sincronização Firestore (${parsed.operationType} em ${parsed.path}): ${parsed.error}`;
        }
      } catch {
        friendly = this.state.message;
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-zinc-100">
                Ops, algo interrompeu a operação
              </h1>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed break-words">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
