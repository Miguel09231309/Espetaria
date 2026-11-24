import { useEffect, useMemo, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { AlertTriangle, Flame, LogOut, RefreshCw } from 'lucide-react';
import { auth, googleProvider } from './lib/firebase';
import {
  ActiveTab,
  CustomHoliday,
  Customer,
  DailyExpense,
  FiadoTransaction,
  Insumo,
  Order,
  Product,
  StoreSettings,
  WhatsappDispatchPrompt,
  WhatsappLog,
} from './types';
import {
  ensureOwnerSeeded,
  logWhatsappDispatch,
  subscribeOwnerCollection,
  subscribeStoreSettings,
  syncCompleteCatalogAndStockLinks,
} from './services/firestoreService';
import { DEFAULT_STORE_SETTINGS } from './data/seedData';
import { getDefaultOperatingDate } from './utils/holidays';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AccessRole, AuthGate } from './components/AuthGate';
import { AppShell } from './components/AppShell';
import { WhatsappDispatchModal } from './components/WhatsappDispatchModal';
import { DailyDashboardView } from './components/views/DailyDashboardView';
import { OrdersPosView } from './components/views/OrdersPosView';
import { ProductsView } from './components/views/ProductsView';
import { InsumosView } from './components/views/InsumosView';
import { CustomersFiadoView } from './components/views/CustomersFiadoView';
import { WeeklyReportView } from './components/views/WeeklyReportView';
import { CustomerStorefrontView } from './components/views/CustomerStorefrontView';
import { SettingsWhatsappView } from './components/views/SettingsWhatsappView';

const ROLE_STORAGE_KEY = 'brasa_access_role';

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou a janela do Google. Libere os popups para este site ou clique em "Entrar sem popup (redirecionar)".';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'A janela de login foi fechada antes de concluir. Tente novamente ou use "Entrar sem popup (redirecionar)".';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Já existe uma tentativa de login aberta. Aguarde um instante e tente novamente.';
  }
  if (code === 'auth/unauthorized-domain') {
    return `Este endereço (${window.location.hostname}) precisa estar autorizado no Firebase Auth, ou acesse pelo link oficial do aplicativo.`;
  }
  if (code === 'auth/operation-not-supported-in-this-environment') {
    return 'Este navegador bloqueou cookies/armazenamento na janela atual. Clique em "Entrar sem popup (redirecionar)" ou abra o site em uma nova aba.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Falha de conexão com a internet ao tentar entrar com o Google.';
  }
  if (code === 'auth/internal-error') {
    return 'O navegador bloqueou a janela de login dentro do quadro atual. Clique em "Entrar sem popup (redirecionar)" ou abra o link do app diretamente no navegador.';
  }
  return `Não foi possível entrar com o Google (${code || 'erro'}): ${msg}`;
}

function MainWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const [accessRole, setAccessRole] = useState<AccessRole>(() => {
    const saved =
      sessionStorage.getItem(ROLE_STORAGE_KEY) || localStorage.getItem(ROLE_STORAGE_KEY);
    return saved === 'client' ? 'client' : 'owner';
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('painel');
  const [seeding, setSeeding] = useState(false);

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fiadoTransactions, setFiadoTransactions] = useState<FiadoTransaction[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsappLog[]>([]);

  const [selectedDate, setSelectedDate] = useState<string>(
    () => getDefaultOperatingDate([]).dateStr
  );
  const [whatsappPrompt, setWhatsappPrompt] = useState<WhatsappDispatchPrompt | null>(null);

  useEffect(() => {
    let mounted = true;

    void getRedirectResult(auth)
      .then((res) => {
        if (mounted && res?.user) {
          setUser(res.user);
          setAuthError(null);
          setAuthErrorCode(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setAuthErrorCode((err as { code?: string })?.code || null);
          setAuthError(formatAuthError(err));
        }
      });

    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!mounted) return;
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setSyncError(null);
      return;
    }
    let active = true;
    setSyncError(null);

    const onSyncErr = (err: Error) => {
      if (!active) return;
      setSyncError(err.message || 'Erro ao sincronizar com o banco de dados.');
    };

    const init = async () => {
      setSeeding(true);
      try {
        const seededNow = await ensureOwnerSeeded(user.uid);
        const syncKey = `brasa_catalog_v2_${user.uid}`;
        if (!seededNow && localStorage.getItem(syncKey) !== 'done') {
          await syncCompleteCatalogAndStockLinks(user.uid);
        }
        localStorage.setItem(syncKey, 'done');
      } catch (err) {
        if (active) {
          setSyncError(
            err instanceof Error ? err.message : 'Falha ao inicializar dados no banco de dados.'
          );
        }
      } finally {
        if (active) setSeeding(false);
      }
    };
    void init();

    const unsubs = [
      subscribeStoreSettings(
        user.uid,
        (s) => {
          if (active) setSettings(s);
        },
        onSyncErr
      ),
      subscribeOwnerCollection<CustomHoliday>(
        'customHolidays',
        user.uid,
        (list) => {
          if (active) setCustomHolidays(list);
        },
        onSyncErr
      ),
      subscribeOwnerCollection<Insumo>(
        'insumos',
        user.uid,
        (list) => {
          if (active) setInsumos(list);
        },
        onSyncErr
      ),
      subscribeOwnerCollection<Product>(
        'products',
        user.uid,
        (list) => {
          if (active) setProducts(list);
        },
        onSyncErr
      ),
      subscribeOwnerCollection<Customer>(
        'customers',
        user.uid,
        (list) => {
          if (active) setCustomers(list);
        },
        onSyncErr
      ),
      subscribeOwnerCollection<Order>(
        'orders',
        user.uid,
        (list) => {
          if (active) setOrders(list);
        },
        onSyncErr
      ),
      subscribeOwnerCollection<FiadoTransaction>(
        'fiadoTransactions',
        user.uid,
        (list) => {
          if (active) setFiadoTransactions(list);
        },
        onSyncErr
      ),
      subscribeOwnerCollection<DailyExpense>(
        'dailyExpenses',
        user.uid,
        (list) => {
          if (active) setExpenses(list);
        },
        onSyncErr
      ),
      subscribeOwnerCollection<WhatsappLog>(
        'whatsappLogs',
        user.uid,
        (list) => {
          if (active) setWhatsappLogs(list);
        },
        onSyncErr
      ),
    ];

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [user, retryTick]);

  const effectiveSettings: StoreSettings = useMemo(
    () =>
      settings ?? {
        ownerId: user?.uid ?? '',
        ...DEFAULT_STORE_SETTINGS,
      },
    [settings, user?.uid]
  );

  const lowStockCount = useMemo(
    () => insumos.filter((i) => i.currentStock <= i.minStock).length,
    [insumos]
  );

  const openFiadoCount = useMemo(
    () => customers.filter((c) => c.fiadoBalance > 0).length,
    [customers]
  );

  const updateRole = (role: AccessRole) => {
    setAccessRole(role);
    sessionStorage.setItem(ROLE_STORAGE_KEY, role);
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  };

  const handleLogin = async (role: AccessRole) => {
    setAuthError(null);
    setAuthErrorCode(null);
    setLoggingIn(true);
    updateRole(role);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setUser(result.user);
      }
    } catch (err) {
      setAuthErrorCode((err as { code?: string })?.code || null);
      setAuthError(formatAuthError(err));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLoginRedirect = async (role: AccessRole) => {
    setAuthError(null);
    setAuthErrorCode(null);
    setLoggingIn(true);
    updateRole(role);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      setAuthErrorCode((err as { code?: string })?.code || null);
      setAuthError(formatAuthError(err));
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem(ROLE_STORAGE_KEY);
    localStorage.removeItem(ROLE_STORAGE_KEY);
    setAccessRole('owner');
    setSyncError(null);
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-zinc-400">Carregando sistema...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        onLogin={handleLogin}
        onLoginRedirect={handleLoginRedirect}
        authError={authError}
        authErrorCode={authErrorCode}
        loggingIn={loggingIn}
      />
    );
  }

  if (syncError) {
    let readable = syncError;
    try {
      const parsed = JSON.parse(syncError);
      if (parsed?.error) {
        readable = `Erro ao acessar o banco de dados (${parsed.operationType} em ${parsed.path}): ${parsed.error}`;
      }
    } catch {
      readable = syncError;
    }

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h1 className="text-lg font-semibold text-white">
              Não foi possível carregar o banco de dados
            </h1>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed break-words">{readable}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSyncError(null);
                setRetryTick((t) => t + 1);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700"
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (seeding && !settings) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center space-y-2 max-w-sm w-full">
          <div className="text-base font-semibold text-white">
            Preparando sua barraca na nuvem
          </div>
          <p className="text-xs text-zinc-400">
            Carregando cardápio inicial, insumos de estoque e calendário de domingos e feriados...
          </p>
        </div>
      </div>
    );
  }

  // Modo Cliente: acesso restrito somente para fazer pedido
  if (accessRole === 'client') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <Flame className="w-5 h-5 text-orange-500 shrink-0" />
              <span className="font-display text-lg font-bold text-white truncate whitespace-nowrap">
                {effectiveSettings.storeName}
              </span>
            </div>

            <div className="hidden sm:block text-xs text-zinc-400 whitespace-nowrap">
              Área do Cliente · Somente Pedidos
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6">
          <CustomerStorefrontView
            ownerId={user.uid}
            products={products}
            insumos={insumos}
            customers={customers}
            orders={orders}
            customHolidays={customHolidays}
            settings={effectiveSettings}
            clientOnlyMode={true}
          />
        </main>
      </div>
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      storeName={effectiveSettings.storeName}
      userEmail={user.email || ''}
      onLogout={() => void handleLogout()}
      onSwitchToClientMode={() => updateRole('client')}
      customHolidays={customHolidays}
      lowStockCount={lowStockCount}
      openFiadoCount={openFiadoCount}
    >
      {activeTab === 'painel' && (
        <DailyDashboardView
          ownerId={user.uid}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          orders={orders}
          expenses={expenses}
          insumos={insumos}
          products={products}
          customers={customers}
          customHolidays={customHolidays}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'pedidos' && (
        <OrdersPosView
          ownerId={user.uid}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          products={products}
          insumos={insumos}
          customers={customers}
          orders={orders}
          customHolidays={customHolidays}
          settings={effectiveSettings}
          onTriggerWhatsapp={setWhatsappPrompt}
        />
      )}

      {activeTab === 'produtos' && (
        <ProductsView
          ownerId={user.uid}
          products={products}
          insumos={insumos}
          orders={orders}
        />
      )}

      {activeTab === 'insumos' && (
        <InsumosView
          ownerId={user.uid}
          insumos={insumos}
          products={products}
          orders={orders}
        />
      )}

      {activeTab === 'clientes' && (
        <CustomersFiadoView
          ownerId={user.uid}
          customers={customers}
          fiadoTransactions={fiadoTransactions}
          orders={orders}
          settings={effectiveSettings}
          onTriggerWhatsapp={setWhatsappPrompt}
        />
      )}

      {activeTab === 'relatorios' && (
        <WeeklyReportView
          orders={orders}
          expenses={expenses}
          fiadoTransactions={fiadoTransactions}
          ownerWhatsapp={effectiveSettings.ownerWhatsapp}
          storeName={effectiveSettings.storeName}
        />
      )}

      {activeTab === 'vitrine' && (
        <CustomerStorefrontView
          ownerId={user.uid}
          products={products}
          insumos={insumos}
          customers={customers}
          orders={orders}
          customHolidays={customHolidays}
          settings={effectiveSettings}
        />
      )}

      {activeTab === 'configuracoes' && (
        <SettingsWhatsappView
          ownerId={user.uid}
          settings={effectiveSettings}
          customHolidays={customHolidays}
          whatsappLogs={whatsappLogs}
          insumos={insumos}
          products={products}
          customers={customers}
          orders={orders}
          fiadoTransactions={fiadoTransactions}
          expenses={expenses}
        />
      )}

      <WhatsappDispatchModal
        prompt={whatsappPrompt}
        onClose={() => setWhatsappPrompt(null)}
        onConfirmLog={async (editedMessage) => {
          if (!whatsappPrompt) return;
          await logWhatsappDispatch({
            ownerId: user.uid,
            customerId: whatsappPrompt.customerId,
            customerName: whatsappPrompt.customerName,
            whatsapp: whatsappPrompt.whatsapp,
            orderId: whatsappPrompt.orderId,
            type: whatsappPrompt.type,
            message: editedMessage,
          });
        }}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainWorkspace />
    </ErrorBoundary>
  );
}
