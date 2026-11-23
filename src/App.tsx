import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Home, Radio, Search, Tv, User } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { HomeView, LiveTvView, MoviesView, ProfileView, SearchView, SeriesView } from './components/CustomerViews';
import {
  AdminLoginPage,
  AuthModal,
  CommentsModal,
  InfoModal,
  MovieDetailsModal,
  PaymentSuccessPage,
  PENDING_PESAPAL_ORDER_KEY,
  PendingPesapalOrder,
  PesapalModal,
  PlansModal,
  PlayerModal,
  VipPaymentPopupModal,
  WorkerStatusResponse,
} from './components/Modals';
import { OfflineIndicator } from './components/PWAInstallButton';
import {
  BRAND_LOGO_URL,
  DB_KEY,
  isVipLabel,
  LIVE_SYNC_CHANNEL,
  loadState,
  LOCKED_ADMIN_EMAIL,
  openMediaDB,
  resolveMediaUrl,
  saveState,
} from './storage';
import { clearOldCachesAndCheckUpdates } from './cacheSync';
import {
  deletePaymentRequestInSupabase,
  fetchPaymentRequestsFromSupabase,
  fetchSupabasePublicState,
  insertPaymentRequestToSupabase,
  subscribeToSupabasePublicChanges,
  syncStateChangesToSupabase,
  updatePaymentRequestInSupabase,
} from './supabaseClient';
import type { AppState, AppView, InfoModalType, LiveTvChannel, PendingPlan, PlayerMedia, Season } from './types';

const PROCESSED_PESAPAL_ORDERS_KEY = 'vj_emma_processed_pesapal_orders';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [isPaymentSuccessRoute, setIsPaymentSuccessRoute] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.location.pathname.startsWith('/payment-success')
  );
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/admin')
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingPlansAfterAuth, setPendingPlansAfterAuth] = useState(false);
  const [pendingVipTitle, setPendingVipTitle] = useState<string | undefined>(undefined);
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [vipPopupOpen, setVipPopupOpen] = useState(false);
  const [vipPopupTitle, setVipPopupTitle] = useState<string | undefined>(undefined);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const [detailsMovieId, setDetailsMovieId] = useState<string | null>(null);
  const [detailsSeasonId, setDetailsSeasonId] = useState<string | null>(null);
  const [activePlayerMedia, setActivePlayerMedia] = useState<PlayerMedia | null>(null);
  const [commentsMovieId, setCommentsMovieId] = useState<string | null>(null);
  const [infoModalType, setInfoModalType] = useState<InfoModalType | null>(null);
  const [adminEditMovieId, setAdminEditMovieId] = useState<string | null>(null);
  const [adminEditChannelId, setAdminEditChannelId] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [paymentRequestsError, setPaymentRequestsError] = useState<string | null>(null);
  const latestStateRef = useRef<AppState>(state);
  latestStateRef.current = state;

  useEffect(() => {
    openMediaDB();
  }, []);

  const refreshFromSupabase = useCallback(async (forceRemote = false) => {
    const patch = await fetchSupabasePublicState(latestStateRef.current, { forceRemote });
    if (!patch) return false;
    setState((prev) => {
      const next: AppState = {
        ...prev,
        ...patch,
        isAdminLoggedIn: prev.isAdminLoggedIn,
        currentUser: prev.currentUser,
        users: prev.users,
        wallet: prev.wallet,
        walletTransactions: prev.walletTransactions,
        adminEmail: prev.adminEmail,
        adminPassword: prev.adminPassword,
      };
      latestStateRef.current = next;
      saveState(next);
      return next;
    });
    return true;
  }, []);

  const refreshPaymentRequests = useCallback(async () => {
    const res = await fetchPaymentRequestsFromSupabase();
    if (!res.ok) {
      setPaymentRequestsError(res.error || 'Could not load payment_requests from Supabase.');
      return false;
    }
    setPaymentRequestsError(null);
    const now = Date.now();
    const activeClientsCount = res.users.filter(
      (u) => u.status === 'approved' && u.subscribed && u.expiry > now
    ).length;

    setState((prev) => {
      let nextCurrentUser = prev.currentUser;
      if (prev.currentUser && prev.currentUser.role !== 'admin') {
        const curEmail = prev.currentUser.email.toLowerCase();
        const curPhone = prev.currentUser.phone;
        const matches = res.users.filter(
          (u) =>
            (prev.currentUser?.id && u.id === prev.currentUser.id) ||
            (curEmail && u.email.toLowerCase() === curEmail) ||
            (curPhone && u.phone === curPhone)
        );
        if (matches.length > 0) {
          const blockedMatch = matches.find((u) => u.status === 'blocked');
          const activeMatch = matches.find(
            (u) => u.status === 'approved' && u.subscribed && u.expiry > now
          );
          const pendingMatch = matches.find((u) => u.status === 'pending');
          const bestMatch = blockedMatch || activeMatch || pendingMatch || matches[0];
          nextCurrentUser = {
            ...prev.currentUser,
            id: bestMatch.id,
            name: bestMatch.name || prev.currentUser.name,
            subscribed: Boolean(activeMatch),
            plan: activeMatch ? activeMatch.plan : null,
            status: blockedMatch
              ? 'blocked'
              : activeMatch
                ? 'approved'
                : pendingMatch
                  ? 'pending'
                  : bestMatch.status,
            expiry: activeMatch ? activeMatch.expiry : 0,
          };
        }
      }

      const next: AppState = {
        ...prev,
        users: res.users,
        walletTransactions: res.transactions,
        wallet: res.wallet,
        clients: activeClientsCount,
        currentUser: nextCurrentUser,
      };
      latestStateRef.current = next;
      saveState(next);
      return next;
    });
    return true;
  }, []);

  useEffect(() => {
    clearOldCachesAndCheckUpdates().finally(() => {
      Promise.all([refreshFromSupabase(true), refreshPaymentRequests()]).finally(() =>
        setIsCatalogLoading(false)
      );
    });

    const unsubRealtime = subscribeToSupabasePublicChanges(() => {
      refreshFromSupabase(false);
      refreshPaymentRequests();
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearOldCachesAndCheckUpdates();
        refreshFromSupabase(false);
        refreshPaymentRequests();
      }
    };
    const onFocusOrShow = () => {
      clearOldCachesAndCheckUpdates();
      refreshFromSupabase(false);
      refreshPaymentRequests();
    };
    const onOnline = () => {
      refreshFromSupabase(true);
      refreshPaymentRequests();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocusOrShow);
    window.addEventListener('pageshow', onFocusOrShow);
    window.addEventListener('online', onOnline);

    const pollId = window.setInterval(() => {
      refreshFromSupabase(false);
      refreshPaymentRequests();
    }, 20000);

    return () => {
      unsubRealtime();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocusOrShow);
      window.removeEventListener('pageshow', onFocusOrShow);
      window.removeEventListener('online', onOnline);
      window.clearInterval(pollId);
    };
  }, [refreshFromSupabase, refreshPaymentRequests]);

  useEffect(() => {
    const syncFromStorage = () => {
      const fresh = loadState();
      setState((prev) => ({
        ...prev,
        adminPassword: fresh.adminPassword,
        isAdminLoggedIn: prev.isAdminLoggedIn,
        currentUser: prev.isAdminLoggedIn ? prev.currentUser : fresh.currentUser,
      }));
      refreshFromSupabase(false);
      refreshPaymentRequests();
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === DB_KEY || e.key === 'vj_emma_session_v1') {
        syncFromStorage();
      }
    };
    window.addEventListener('storage', onStorage);

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(LIVE_SYNC_CHANNEL);
      bc.onmessage = () => syncFromStorage();
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      bc?.close();
    };
  }, [refreshFromSupabase, refreshPaymentRequests]);

  useEffect(() => {
    const onPopState = () => {
      setIsPaymentSuccessRoute(window.location.pathname.startsWith('/payment-success'));
      setIsAdminRoute(window.location.pathname.toLowerCase().startsWith('/admin'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.title = 'VJ Emma - True Light Production | The Pride of Luo';
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    await clearOldCachesAndCheckUpdates();
    const [updated] = await Promise.all([refreshFromSupabase(true), refreshPaymentRequests()]);
    showToast(updated ? 'Updated with latest movies & series!' : 'Catalog is up to date.');
  }, [refreshFromSupabase, refreshPaymentRequests, showToast]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const updateState = useCallback(
    (updater: (prev: AppState) => AppState) => {
      const prev = latestStateRef.current;
      const next = updater(prev);
      latestStateRef.current = next;
      saveState(next);
      setState(next);
      syncStateChangesToSupabase(prev, next).then((res) => {
        if (!res.ok && next.isAdminLoggedIn) {
          showToast(`Cloud Database sync warning: ${res.error || 'Could not sync'}`);
        }
      });
    },
    [showToast]
  );

  const switchView = useCallback(
    (viewName: AppView) => {
      if (viewName === 'admin') {
        try {
          window.history.pushState({}, '', '/admin');
        } catch {
          // Ignore pushState restrictions
        }
        setIsPaymentSuccessRoute(false);
        setIsAdminRoute(true);
        if (state.isAdminLoggedIn) {
          setCurrentView('admin');
        }
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        return;
      }

      if (isPaymentSuccessRoute || isAdminRoute) {
        try {
          window.history.pushState({}, '', '/');
        } catch {
          // Ignore pushState restrictions
        }
        setIsPaymentSuccessRoute(false);
        setIsAdminRoute(false);
      }

      setCurrentView(viewName);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [isAdminRoute, isPaymentSuccessRoute, state.isAdminLoggedIn]
  );

  const paymentPlans =
    Array.isArray(state.settings.paymentPlans) && state.settings.paymentPlans.length > 0
      ? state.settings.paymentPlans
      : [
          {
            id: 'plan_weekly',
            name: 'Weekly',
            price: Number(state.settings.priceWeekly || 5000),
            days: 7,
          },
          {
            id: 'plan_monthly',
            name: 'Monthly',
            price: Number(state.settings.priceMonthly || 15000),
            days: 30,
          },
          {
            id: 'plan_vip',
            name: 'VIP',
            price: Number(state.settings.priceVip || 30000),
            days: 30,
          },
        ];

  const nowTs = Date.now();
  const matchingCustomerRows =
    state.currentUser && state.currentUser.role !== 'admin'
      ? state.users.filter(
          (u) =>
            (state.currentUser?.id && u.id === state.currentUser.id) ||
            (state.currentUser?.email &&
              u.email.toLowerCase() === state.currentUser.email.toLowerCase()) ||
            (state.currentUser?.phone && u.phone === state.currentUser.phone)
        )
      : [];

  const blockedCustomerRow = matchingCustomerRows.find((u) => u.status === 'blocked');
  const activeApprovedRow = matchingCustomerRows.find(
    (u) => u.status === 'approved' && u.subscribed && u.expiry > nowTs
  );
  const pendingCustomerRow = matchingCustomerRows.find((u) => u.status === 'pending');
  const liveCustomerAccount =
    blockedCustomerRow || activeApprovedRow || pendingCustomerRow || matchingCustomerRows[0];

  const isBlocked = Boolean(
    state.currentUser &&
      state.currentUser.role !== 'admin' &&
      (blockedCustomerRow || state.currentUser.status === 'blocked')
  );

  const isPendingApproval = Boolean(
    state.currentUser &&
      state.currentUser.role !== 'admin' &&
      !isBlocked &&
      !activeApprovedRow &&
      (pendingCustomerRow ||
        (state.currentUser.status === 'pending' &&
          (!state.currentUser.subscribed || state.currentUser.expiry <= nowTs)))
  );

  const isSubscribed = Boolean(
    state.isAdminLoggedIn ||
      (state.currentUser &&
        !isBlocked &&
        (activeApprovedRow ||
          (!liveCustomerAccount &&
            state.currentUser.subscribed &&
            state.currentUser.expiry > nowTs)))
  );

  const handleHeaderAction = () => {
    if (state.isAdminLoggedIn) {
      switchView('admin');
      return;
    }
    if (state.currentUser) {
      switchView('profile');
      return;
    }
    setPendingPlansAfterAuth(false);
    setAuthModalOpen(true);
  };

  const handleAdminLoginSubmit = (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      showToast('Enter Admin Username / Email and Password.');
      return;
    }
    const isAllowedAdminIdentifier =
      cleanEmail === 'admin' || cleanEmail === LOCKED_ADMIN_EMAIL.toLowerCase();
    if (!isAllowedAdminIdentifier) {
      showToast('Access denied: Invalid Admin credentials.');
      return;
    }
    if (password !== state.adminPassword) {
      showToast('Incorrect Admin Password.');
      return;
    }

    updateState((prev) => ({
      ...prev,
      adminEmail: LOCKED_ADMIN_EMAIL,
      isAdminLoggedIn: true,
      currentUser: {
        phone: 'Admin',
        email: cleanEmail === 'admin' ? LOCKED_ADMIN_EMAIL : cleanEmail,
        role: 'admin',
        subscribed: true,
        plan: 'Admin',
        expiry: Date.now() + 365 * 86400000,
      },
    }));
    setPendingPlansAfterAuth(false);
    setAuthModalOpen(false);
    setIsAdminRoute(true);
    setCurrentView('admin');
    showToast('Welcome Admin');
  };

  const handleAuthSubmit = (phone: string, email: string, password: string) => {
    if (!phone || !email || !password) {
      showToast('Enter Phone, Email, and Password.');
      return;
    }

    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    const matches = state.users.filter(
      (u) => u.email.toLowerCase() === cleanEmail.toLowerCase() || u.phone === cleanPhone
    );
    const blockedMatch = matches.find((u) => u.status === 'blocked');

    if (blockedMatch) {
      setPendingPlansAfterAuth(false);
      showToast('Your account has been blocked by Admin.');
      return;
    }

    const now = Date.now();
    const activeMatch = matches.find(
      (u) => u.status === 'approved' && u.subscribed && u.expiry > now
    );
    const pendingMatch = matches.find((u) => u.status === 'pending');
    const bestMatch = activeMatch || pendingMatch || matches[0] || null;

    if (bestMatch && bestMatch.password && bestMatch.password !== password) {
      showToast('Incorrect password.');
      return;
    }

    const signedInRecordSubscribed = Boolean(activeMatch);
    const signedInRecordPending = Boolean(
      pendingMatch && Boolean(pendingMatch.pendingPlan) && !signedInRecordSubscribed
    );

    updateState((prev) => ({
      ...prev,
      isAdminLoggedIn: false,
      currentUser: {
        id: bestMatch?.id || 'cust_' + now,
        name: bestMatch?.name,
        phone: cleanPhone,
        email: cleanEmail,
        role: 'customer',
        subscribed: signedInRecordSubscribed,
        plan: activeMatch ? activeMatch.plan : null,
        status: pendingMatch && !signedInRecordSubscribed ? 'pending' : 'approved',
        expiry: activeMatch ? activeMatch.expiry : 0,
      },
    }));

    const openPlansNow = pendingPlansAfterAuth;
    const queuedVipTitle = pendingVipTitle;
    setPendingPlansAfterAuth(false);
    setPendingVipTitle(undefined);
    setAuthModalOpen(false);
    showToast('Signed in successfully.');

    if (openPlansNow && !signedInRecordSubscribed) {
      if (signedInRecordPending) {
        showToast('Your WhatsApp payment is pending Admin approval.');
        switchView('profile');
      } else if (queuedVipTitle) {
        setVipPopupTitle(queuedVipTitle);
        setVipPopupOpen(true);
      } else {
        setPlansModalOpen(true);
      }
    }
  };

  const handleLogout = () => {
    updateState((prev) => ({
      ...prev,
      currentUser: null,
      isAdminLoggedIn: false,
    }));
    setPendingPlansAfterAuth(false);
    setPendingVipTitle(undefined);
    setPlansModalOpen(false);
    setVipPopupOpen(false);
    setPendingPlan(null);
    showToast('Signed out.');
    setCurrentView('home');
  };

  const handleWorkerPaymentCompleted = useCallback(
    (orderId: string, workerData: WorkerStatusResponse, savedOrder: PendingPesapalOrder | null) => {
      const cleanName = String(
        workerData.name || savedOrder?.name || state.currentUser?.name || ''
      ).trim();
      const cleanPhone = String(
        workerData.phone || savedOrder?.phone || state.currentUser?.phone || ''
      ).trim();
      const cleanEmail = String(
        workerData.email || savedOrder?.email || state.currentUser?.email || ''
      ).trim();

      const fallbackPlan = paymentPlans[0] || { id: 'plan_1', name: 'Subscription', price: 5000, days: 1 };
      const planName = String(
        workerData.planName || savedOrder?.planName || fallbackPlan.name
      ).trim();

      const matchedPlan = paymentPlans.find(
        (p) => p.name.toLowerCase() === planName.toLowerCase()
      );
      const amount = Number(
        workerData.amount || savedOrder?.amount || matchedPlan?.price || fallbackPlan.price
      );
      const days = Math.max(
        1,
        Number(workerData.days || savedOrder?.days || matchedPlan?.days || fallbackPlan.days || 1)
      );
      const method = savedOrder?.method ? `Pesapal (${savedOrder.method})` : 'Pesapal';
      const now = Date.now();
      const calculatedExpiry = now + days * 86400000;

      let processedIds: string[] = [];
      try {
        processedIds = JSON.parse(localStorage.getItem(PROCESSED_PESAPAL_ORDERS_KEY) || '[]');
        if (!Array.isArray(processedIds)) processedIds = [];
      } catch {
        processedIds = [];
      }

      const txId = `tx_pesapal_${orderId}`;
      const alreadyProcessed =
        processedIds.includes(orderId) ||
        Boolean((state.walletTransactions || []).some((tx) => tx.id === txId));

      if (!alreadyProcessed) {
        updateState((prev) => {
          const existingIdx = prev.users.findIndex(
            (u) =>
              (cleanPhone && u.phone === cleanPhone) ||
              (cleanEmail && u.email.toLowerCase() === cleanEmail.toLowerCase())
          );

          if (existingIdx !== -1 && prev.users[existingIdx].status === 'blocked') {
            return prev;
          }

          const nextUsers = [...prev.users];
          let userId = 'usr_' + now;

          if (existingIdx === -1) {
            nextUsers.unshift({
              id: userId,
              name: cleanName || undefined,
              phone: cleanPhone || cleanEmail || 'Customer',
              email: cleanEmail || `${cleanPhone}@vjemma.site`,
              password: '',
              subscribed: true,
              plan: planName,
              pendingPlan: null,
              pendingAmount: 0,
              pendingDays: 0,
              paymentMethod: method,
              status: 'approved',
              expiry: calculatedExpiry,
              createdAt: now,
            });
          } else {
            userId = nextUsers[existingIdx].id;
            nextUsers[existingIdx] = {
              ...nextUsers[existingIdx],
              name: cleanName || nextUsers[existingIdx].name,
              phone: cleanPhone || nextUsers[existingIdx].phone,
              email: cleanEmail || nextUsers[existingIdx].email,
              subscribed: true,
              plan: planName,
              pendingPlan: null,
              pendingAmount: 0,
              pendingDays: 0,
              paymentMethod: method,
              status: 'approved',
              expiry: calculatedExpiry,
            };
          }

          const subscribedCount = nextUsers.filter(
            (u) => u.subscribed && u.status !== 'blocked' && u.expiry > now
          ).length;

          const nextTx = {
            id: txId,
            name: cleanName || undefined,
            phone: cleanPhone || cleanEmail || 'Customer',
            email: cleanEmail,
            plan: planName,
            amount,
            method,
            status: 'completed' as const,
            createdAt: now,
          };

          const shouldUpdateCurrent = !prev.currentUser || prev.currentUser.role !== 'admin';

          return {
            ...prev,
            users: nextUsers,
            clients: Math.max(prev.clients, subscribedCount),
            wallet: prev.wallet + amount,
            walletTransactions: [nextTx, ...(prev.walletTransactions || [])],
            currentUser: shouldUpdateCurrent
              ? {
                  id: userId,
                  name: cleanName || prev.currentUser?.name,
                  phone: cleanPhone || prev.currentUser?.phone || '',
                  email: cleanEmail || prev.currentUser?.email || '',
                  role: 'customer',
                  subscribed: true,
                  plan: planName,
                  status: 'approved',
                  expiry: calculatedExpiry,
                }
              : prev.currentUser,
          };
        });

        insertPaymentRequestToSupabase({
          name: cleanName || undefined,
          phone: cleanPhone || cleanEmail || 'Customer',
          email: cleanEmail || `${cleanPhone}@vjemma.site`,
          plan: planName,
          amount,
          days,
          paymentMethod: method,
          status: 'approved',
          expiry: calculatedExpiry,
        }).then((res) => {
          if (res.ok) refreshPaymentRequests();
        });

        try {
          localStorage.setItem(
            PROCESSED_PESAPAL_ORDERS_KEY,
            JSON.stringify([...processedIds.slice(-49), orderId])
          );
          localStorage.removeItem(PENDING_PESAPAL_ORDER_KEY);
        } catch {
          // Ignore storage issues
        }
      }

      return {
        expiry: calculatedExpiry,
        planName,
        amount,
        name: cleanName || cleanPhone,
        phone: cleanPhone,
        email: cleanEmail,
      };
    },
    [paymentPlans, refreshPaymentRequests, state.currentUser, state.walletTransactions, updateState]
  );

  const handleReturnFromPaymentSuccess = useCallback(
    (openPlans?: boolean) => {
      try {
        window.history.pushState({}, '', '/');
      } catch {
        // Ignore pushState restrictions
      }
      setIsPaymentSuccessRoute(false);
      setCurrentView('home');
      if (openPlans) {
        setPlansModalOpen(true);
      }
    },
    []
  );

  const recordWhatsappOrder = async (
    planObj: PendingPlan,
    phone: string,
    email: string,
    method: string,
    name?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    const cleanName = name?.trim() || undefined;
    if (!cleanPhone || !cleanEmail) {
      const msg = 'Enter your phone number and email first.';
      showToast(msg);
      return { ok: false, error: msg };
    }

    const existingBlocked = state.users.find(
      (u) =>
        (u.phone === cleanPhone || u.email.toLowerCase() === cleanEmail.toLowerCase()) &&
        u.status === 'blocked'
    );
    if (existingBlocked) {
      const msg = 'This account has been blocked by Admin.';
      showToast(msg);
      return { ok: false, error: msg };
    }

    const insertRes = await insertPaymentRequestToSupabase({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      plan: planObj.planName,
      amount: Number(planObj.amount),
      days: Math.max(1, Number(planObj.days || 1)),
      paymentMethod: `Manual WhatsApp (${method})`,
      status: 'pending',
      expiry: 0,
    });

    if (!insertRes.ok || !insertRes.user) {
      const errMsg = insertRes.error || 'Could not save payment request to Supabase.';
      setPaymentRequestsError(errMsg);
      showToast(`Payment submit failed: ${errMsg}`);
      return { ok: false, error: errMsg };
    }

    const savedRow = insertRes.user;
    setPaymentRequestsError(null);

    setState((prev) => {
      const nextTx = {
        id: `tx_${savedRow.id}`,
        name: savedRow.name,
        phone: savedRow.phone,
        email: savedRow.email,
        plan: savedRow.pendingPlan || planObj.planName,
        amount: Number(savedRow.pendingAmount || planObj.amount),
        method: savedRow.paymentMethod || `Manual WhatsApp (${method})`,
        status: 'pending' as const,
        createdAt: savedRow.createdAt || Date.now(),
      };
      const nextCurrent =
        prev.currentUser && prev.currentUser.role !== 'admin'
          ? {
              ...prev.currentUser,
              name: savedRow.name || prev.currentUser.name,
              subscribed: Boolean(
                prev.currentUser.subscribed && (prev.currentUser.expiry || 0) > Date.now()
              ),
              status:
                prev.currentUser.subscribed && (prev.currentUser.expiry || 0) > Date.now()
                  ? ('approved' as const)
                  : ('pending' as const),
            }
          : prev.currentUser || {
              id: savedRow.id,
              name: savedRow.name,
              phone: savedRow.phone,
              email: savedRow.email,
              role: 'customer' as const,
              subscribed: false,
              plan: null,
              status: 'pending' as const,
              expiry: 0,
            };

      const next: AppState = {
        ...prev,
        users: [savedRow, ...prev.users],
        walletTransactions: [nextTx, ...(prev.walletTransactions || [])],
        currentUser: nextCurrent,
      };
      latestStateRef.current = next;
      saveState(next);
      return next;
    });

    refreshPaymentRequests();
    showToast('WhatsApp payment request submitted! Pending Admin approval.');
    return { ok: true };
  };

  const handleManualWhatsappPayment = async (
    phone: string,
    email: string,
    method: string,
    name?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!pendingPlan) {
      return { ok: false, error: 'No subscription plan selected.' };
    }
    return recordWhatsappOrder(pendingPlan, phone, email, method, name);
  };

  const handleApprovePaymentRequest = useCallback(
    async (userId: string, overridePlan?: string): Promise<{ ok: boolean; error?: string }> => {
      const target = latestStateRef.current.users.find((u) => u.id === userId);
      if (!target) return { ok: false, error: 'Payment request row not found.' };

      const chosenPlan =
        overridePlan ||
        target.pendingPlan ||
        target.plan ||
        paymentPlans[0]?.name ||
        'Monthly';
      const matched = paymentPlans.find(
        (p) => p.name.toLowerCase() === chosenPlan.toLowerCase()
      );
      const days = Math.max(1, Number(target.pendingDays || matched?.days || 1));
      const amount = Number(target.pendingAmount || matched?.price || 0);
      const expiry = Date.now() + days * 86400000;

      const res = await updatePaymentRequestInSupabase(userId, {
        status: 'approved',
        plan: chosenPlan,
        amount,
        days,
        expiry,
      });
      if (!res.ok) return { ok: false, error: res.error };
      await refreshPaymentRequests();
      return { ok: true };
    },
    [paymentPlans, refreshPaymentRequests]
  );

  const handleBlockPaymentRequest = useCallback(
    async (userId: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await updatePaymentRequestInSupabase(userId, {
        status: 'blocked',
        expiry: 0,
      });
      if (!res.ok) return { ok: false, error: res.error };
      await refreshPaymentRequests();
      return { ok: true };
    },
    [refreshPaymentRequests]
  );

  const handleDeletePaymentRequest = useCallback(
    async (userId: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await deletePaymentRequestInSupabase(userId);
      if (!res.ok) return { ok: false, error: res.error };
      await refreshPaymentRequests();
      return { ok: true };
    },
    [refreshPaymentRequests]
  );

  const handleAddManualPaymentRequest = useCallback(
    async (input: {
      phone: string;
      email: string;
      plan: string;
      amount: number;
      days: number;
    }): Promise<{ ok: boolean; error?: string }> => {
      const days = Math.max(1, Number(input.days || 1));
      const res = await insertPaymentRequestToSupabase({
        phone: input.phone,
        email: input.email,
        plan: input.plan,
        amount: Number(input.amount || 0),
        days,
        paymentMethod: 'Admin Manual Approval',
        status: 'approved',
        expiry: Date.now() + days * 86400000,
      });
      if (!res.ok) return { ok: false, error: res.error };
      await refreshPaymentRequests();
      return { ok: true };
    },
    [refreshPaymentRequests]
  );

  const buildDownloadFileName = (title: string, videoUrl: string): string => {
    const base = (title || 'vj-emma-video').replace(/[^a-zA-Z0-9._-]/g, '_');
    const cleanUrl = (videoUrl || '').split(/[?#]/)[0];
    const extMatch = cleanUrl.match(/\.(mp4|mkv|avi|mov|webm|m4v|flv|wmv|3gp|ts|ogg|ogv|mpeg|mpg)$/i);
    return extMatch ? `${base}.${extMatch[1].toLowerCase()}` : `${base}.mp4`;
  };

  const triggerDirectDownload = (videoUrl: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Starting download...');
  };

  const guardPlaybackAccess = (
    label: string,
    isVipPoster = false,
    itemTitle?: string
  ): boolean => {
    if (!state.currentUser) {
      setPendingPlansAfterAuth(true);
      setPendingVipTitle(isVipPoster ? itemTitle || 'VIP Movie' : undefined);
      setAuthModalOpen(true);
      showToast(
        isVipPoster
          ? 'VIP locked. Please sign in first, then pay to watch or download.'
          : `Please sign in first to choose a plan and watch ${label}.`
      );
      return false;
    }
    if (isBlocked) {
      showToast('Your account is blocked by Admin.');
      switchView('profile');
      return false;
    }
    if (isPendingApproval) {
      showToast('Your WhatsApp payment is pending Admin approval.');
      switchView('profile');
      return false;
    }
    if (!isSubscribed) {
      if (isVipPoster) {
        setVipPopupTitle(itemTitle);
        setVipPopupOpen(true);
        showToast('This is VIP Movie. You need to pay to Watch / Download.');
      } else {
        setPlansModalOpen(true);
        showToast(`Please subscribe to watch & download ${label}.`);
      }
      return false;
    }
    return true;
  };

  const handleRequestWatchMovie = async (movieId: string) => {
    const m = state.movies.find((x) => x.id === movieId);
    if (!m) return;
    const isVipPoster = isVipLabel(m.label);
    if (!guardPlaybackAccess('movies', isVipPoster, m.title)) return;
    const url = await resolveMediaUrl(m.video);
    if (!url) {
      showToast('No video source attached to this title.');
      return;
    }
    setDetailsMovieId(null);
    setActivePlayerMedia({
      title: m.title,
      videoUrl: url,
      description: m.description || '',
      fileName: buildDownloadFileName(m.title, url),
    });
  };

  const handleRequestDownloadMovie = async (movieId: string) => {
    const m = state.movies.find((x) => x.id === movieId);
    if (!m) return;
    const isVipPoster = isVipLabel(m.label);
    if (!guardPlaybackAccess('movies', isVipPoster, m.title)) return;
    const url = await resolveMediaUrl(m.video);
    if (!url) {
      showToast('No downloadable video source attached to this title.');
      return;
    }
    triggerDirectDownload(url, buildDownloadFileName(m.title, url));
  };

  const handleRequestWatchEpisode = async (episodeId: string) => {
    const ep = state.episodes.find((x) => x.id === episodeId);
    if (!ep) return;
    const season = state.seasons.find((s) => s.id === ep.seasonId);
    const isVipSeason = isVipLabel(season?.label);
    const titleLabel = season ? `${season.seriesTitle} · Ep ${ep.episodeNumber}` : ep.title;
    if (!guardPlaybackAccess('episodes', isVipSeason, titleLabel)) return;
    const url = await resolveMediaUrl(ep.video);
    if (!url) {
      showToast('No video source attached to this episode.');
      return;
    }
    setDetailsSeasonId(null);
    setActivePlayerMedia({
      title: `Ep ${ep.episodeNumber}: ${ep.title}`,
      videoUrl: url,
      description: season?.description || '',
      fileName: buildDownloadFileName(ep.title, url),
    });
  };

  const handleRequestDownloadEpisode = async (episodeId: string) => {
    const ep = state.episodes.find((x) => x.id === episodeId);
    if (!ep) return;
    const season = state.seasons.find((s) => s.id === ep.seasonId);
    const isVipSeason = isVipLabel(season?.label);
    const titleLabel = season ? `${season.seriesTitle} · Ep ${ep.episodeNumber}` : ep.title;
    if (!guardPlaybackAccess('episodes', isVipSeason, titleLabel)) return;
    const url = await resolveMediaUrl(ep.video);
    if (!url) {
      showToast('No downloadable video source attached to this episode.');
      return;
    }
    triggerDirectDownload(url, buildDownloadFileName(ep.title, url));
  };

  const handleTapLockedVipSeason = (season: Season) => {
    guardPlaybackAccess(
      'episodes',
      isVipLabel(season.label),
      `${season.seriesTitle} · Season ${season.seasonNumber}`
    );
  };

  const handleRequestWatchLiveTv = (channel: LiveTvChannel) => {
    if (!guardPlaybackAccess('Live TV', false, channel.name)) return;
    if (!channel.streamUrl) {
      showToast('No Live TV stream link attached to this channel.');
      return;
    }
    setActivePlayerMedia({
      title: `${channel.name} (LIVE TV)`,
      videoUrl: channel.streamUrl,
      description: channel.category ? `Live Broadcast · ${channel.category}` : 'Live Broadcast',
      fileName: buildDownloadFileName(channel.name, channel.streamUrl),
      isLive: true,
    });
  };

  const handleToggleLike = (movieId: string) => {
    updateState((prev) => {
      const current = prev.likes[movieId] || { count: 0, liked: false };
      const nextLiked = !current.liked;
      return {
        ...prev,
        likes: {
          ...prev.likes,
          [movieId]: {
            liked: nextLiked,
            count: nextLiked ? current.count + 1 : Math.max(0, current.count - 1),
          },
        },
      };
    });
  };

  const handleShareMovie = (itemId: string) => {
    const m = state.movies.find((x) => x.id === itemId);
    const s = !m ? state.seasons.find((x) => x.id === itemId) : undefined;
    const ch = !m && !s ? (state.liveTvChannels || []).find((x) => x.id === itemId) : undefined;
    const itemTitle = m
      ? m.title
      : s
      ? `${s.seriesTitle} - Season ${s.seasonNumber}`
      : ch
      ? ch.name
      : '';
    if (!itemTitle) return;
    const shareText = `Watch "${itemTitle}" on ${state.settings.appName}`;
    if (navigator.share) {
      navigator.share({ title: itemTitle, text: shareText, url: window.location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(`${shareText} - ${window.location.href}`)
        .then(() => showToast('Link copied to share.'))
        .catch(() => showToast('Ready to share!'));
    } else {
      showToast(shareText);
    }
  };

  const handlePostComment = (text: string) => {
    if (!commentsMovieId) return;
    const author = state.currentUser ? state.currentUser.email.split('@')[0] : 'Viewer';
    updateState((prev) => {
      const existing = prev.comments[commentsMovieId] || [];
      return {
        ...prev,
        comments: {
          ...prev.comments,
          [commentsMovieId]: [{ author, text, time: Date.now() }, ...existing],
        },
      };
    });
  };

  const handleAdminEditMovie = useCallback(
    (movieId: string) => {
      if (!state.isAdminLoggedIn) return;
      setAdminEditMovieId(movieId);
      setCurrentView('admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [state.isAdminLoggedIn]
  );

  const handleAdminDeleteMovie = useCallback(
    (movieId: string) => {
      if (!state.isAdminLoggedIn) return;
      updateState((prev) => ({
        ...prev,
        movies: prev.movies.filter((m) => m.id !== movieId),
      }));
      showToast('Movie deleted.');
    },
    [state.isAdminLoggedIn, updateState, showToast]
  );

  const handleAdminEditChannel = useCallback(
    (channelId: string) => {
      if (!state.isAdminLoggedIn) return;
      setAdminEditChannelId(channelId);
      setCurrentView('admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [state.isAdminLoggedIn]
  );

  const handleAdminDeleteChannel = useCallback(
    (channelId: string) => {
      if (!state.isAdminLoggedIn) return;
      updateState((prev) => ({
        ...prev,
        liveTvChannels: (prev.liveTvChannels || []).filter((ch) => ch.id !== channelId),
      }));
      showToast('Live TV channel deleted.');
    },
    [state.isAdminLoggedIn, updateState, showToast]
  );

  const fullAppName = state.settings.appName || 'VJ EMMA - TRUE LIGHT PRODUCTION';
  const brandTitle = (fullAppName.split('-')[0] || 'VJ EMMA').trim();

  const headerBtnLabel = state.isAdminLoggedIn
    ? 'Admin'
    : state.currentUser
    ? 'Account'
    : 'Sign In';

  const activeCommentsMovie = commentsMovieId
    ? state.movies.find((m) => m.id === commentsMovieId)
    : undefined;
  const activeCommentsSeason =
    commentsMovieId && !activeCommentsMovie
      ? state.seasons.find((s) => s.id === commentsMovieId)
      : undefined;
  const activeCommentsChannel =
    commentsMovieId && !activeCommentsMovie && !activeCommentsSeason
      ? (state.liveTvChannels || []).find((ch) => ch.id === commentsMovieId)
      : undefined;
  const activeCommentsTitle = activeCommentsMovie
    ? activeCommentsMovie.title
    : activeCommentsSeason
    ? `${activeCommentsSeason.seriesTitle} (Season ${activeCommentsSeason.seasonNumber})`
    : activeCommentsChannel
    ? activeCommentsChannel.name
    : '';

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* TOP HEADER: LOGO + VJ EMMA LEFT, SEARCH + SIGN IN RIGHT */}
      <header className="fixed inset-x-0 top-0 z-[900] flex h-16 items-center justify-between gap-2 border-b-2 border-[#6a0dad]/80 bg-gradient-to-r from-[#050507] via-[#130820] to-[#050507] px-2.5 sm:px-3.5 backdrop-blur-md">
        <button
          type="button"
          onClick={() => switchView('home')}
          className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2.5 text-left"
        >
          <img
            src={BRAND_LOGO_URL}
            alt="VJ EMMA Logo"
            referrerPolicy="no-referrer"
            className="h-9 w-9 sm:h-11 sm:w-11 shrink-0 rounded-full border-2 border-[#d4af37] bg-[#050507] object-cover shadow"
          />
          <span className="whitespace-nowrap font-brand text-[15px] sm:text-xl font-bold tracking-[0.02em] sm:tracking-[0.06em] text-[#f0cf65]">
            {brandTitle}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => switchView('search')}
            aria-label="Search movies and series"
            className={`flex min-h-[38px] sm:min-h-[40px] items-center gap-1 whitespace-nowrap rounded-full border px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold transition-colors active:scale-95 ${
              currentView === 'search' && !isPaymentSuccessRoute && !isAdminRoute
                ? 'border-[#d4af37] bg-[#d4af37] text-black'
                : 'border-[#6a0dad] bg-[#140d22] text-white hover:border-[#d4af37]'
            }`}
          >
            <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Search</span>
          </button>

          <button
            type="button"
            onClick={handleHeaderAction}
            className="min-h-[38px] sm:min-h-[40px] shrink-0 whitespace-nowrap rounded-full border border-[#d4af37] bg-gradient-to-r from-[#6a0dad] to-[#4a077a] px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-semibold text-white shadow transition-transform active:scale-95"
          >
            {headerBtnLabel}
          </button>
        </div>
      </header>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed left-1/2 top-[74px] z-[1600] max-w-[90%] -translate-x-1/2 rounded-full border border-[#d4af37] bg-[#6a0dad] px-4 py-2 text-center text-xs font-bold text-white shadow-xl">
          {toastMessage}
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="mx-auto min-h-screen w-full max-w-[1200px] pb-[84px] pt-16">
        {isPaymentSuccessRoute ? (
          <PaymentSuccessPage
            onPaymentCompleted={handleWorkerPaymentCompleted}
            onReturnHome={handleReturnFromPaymentSuccess}
          />
        ) : isAdminRoute && !state.isAdminLoggedIn ? (
          <AdminLoginPage
            onSubmit={handleAdminLoginSubmit}
            onReturnSite={() => switchView('home')}
          />
        ) : (isAdminRoute || currentView === 'admin') && state.isAdminLoggedIn ? (
          <AdminPanel
            state={state}
            updateState={updateState}
            onViewSite={() => switchView('home')}
            onLogout={() => {
              try {
                window.history.pushState({}, '', '/');
              } catch {
                // Ignore pushState restrictions
              }
              setIsAdminRoute(false);
              handleLogout();
            }}
            onNotify={showToast}
            paymentRequestsError={paymentRequestsError}
            onRefreshPaymentRequests={async () => {
              await refreshPaymentRequests();
            }}
            onApprovePaymentRequest={handleApprovePaymentRequest}
            onBlockPaymentRequest={handleBlockPaymentRequest}
            onDeletePaymentRequest={handleDeletePaymentRequest}
            onAddManualPaymentRequest={handleAddManualPaymentRequest}
            initialEditMovieId={adminEditMovieId}
            onClearInitialEditMovie={() => setAdminEditMovieId(null)}
            initialEditChannelId={adminEditChannelId}
            onClearInitialEditChannel={() => setAdminEditChannelId(null)}
          />
        ) : (
          <>
            {currentView === 'home' && (
              <HomeView
                state={state}
                isSubscribed={isSubscribed}
                isCatalogLoading={isCatalogLoading}
                onWatchMovie={handleRequestWatchMovie}
                onOpenMovieDetails={(id) => {
                  setDetailsSeasonId(null);
                  setDetailsMovieId(id);
                }}
                onOpenSeasonDetails={(id) => {
                  setDetailsMovieId(null);
                  setDetailsSeasonId(id);
                }}
                onTapLockedVipSeason={handleTapLockedVipSeason}
                onLikeMovie={handleToggleLike}
                onShareMovie={handleShareMovie}
                onOpenComments={(id) => setCommentsMovieId(id)}
                onOpenInfo={(type) => setInfoModalType(type)}
                onBannerAction={() => switchView('movies')}
                onNotify={showToast}
                onAdminEditMovie={handleAdminEditMovie}
                onAdminDeleteMovie={handleAdminDeleteMovie}
                onRefresh={handleManualRefresh}
              />
            )}

            {currentView === 'movies' && (
              <MoviesView
                state={state}
                isSubscribed={isSubscribed}
                onWatchMovie={handleRequestWatchMovie}
                onOpenMovieDetails={(id) => {
                  setDetailsSeasonId(null);
                  setDetailsMovieId(id);
                }}
                onLikeMovie={handleToggleLike}
                onShareMovie={handleShareMovie}
                onOpenComments={(id) => setCommentsMovieId(id)}
                onOpenInfo={(type) => setInfoModalType(type)}
                onNotify={showToast}
                onAdminEditMovie={handleAdminEditMovie}
                onAdminDeleteMovie={handleAdminDeleteMovie}
              />
            )}

            {currentView === 'series' && (
              <SeriesView
                state={state}
                seasons={state.seasons}
                episodes={state.episodes}
                socialLinksRaw={state.settings.socialLinks}
                isSubscribed={isSubscribed}
                onWatchEpisode={handleRequestWatchEpisode}
                onDownloadEpisode={handleRequestDownloadEpisode}
                onOpenSeasonDetails={(id) => {
                  setDetailsMovieId(null);
                  setDetailsSeasonId(id);
                }}
                onTapLockedVipSeason={handleTapLockedVipSeason}
                onLike={handleToggleLike}
                onShare={handleShareMovie}
                onOpenComments={(id) => setCommentsMovieId(id)}
                onOpenInfo={(type) => setInfoModalType(type)}
                onNotify={showToast}
              />
            )}

            {currentView === 'livetv' && (
              <LiveTvView
                state={state}
                onWatchChannel={handleRequestWatchLiveTv}
                onLike={handleToggleLike}
                onShare={handleShareMovie}
                onOpenComments={(id) => setCommentsMovieId(id)}
                onOpenInfo={(type) => setInfoModalType(type)}
                onNotify={showToast}
                onAdminEditChannel={handleAdminEditChannel}
                onAdminDeleteChannel={handleAdminDeleteChannel}
              />
            )}

            {currentView === 'search' && (
              <SearchView
                state={state}
                isSubscribed={isSubscribed}
                onWatchMovie={handleRequestWatchMovie}
                onOpenMovieDetails={(id) => {
                  setDetailsSeasonId(null);
                  setDetailsMovieId(id);
                }}
                onWatchEpisode={handleRequestWatchEpisode}
                onLikeMovie={handleToggleLike}
                onShareMovie={handleShareMovie}
                onOpenComments={(id) => setCommentsMovieId(id)}
                onAdminEditMovie={handleAdminEditMovie}
                onAdminDeleteMovie={handleAdminDeleteMovie}
              />
            )}

            {currentView === 'profile' && (
              <ProfileView
                state={state}
                isSubscribed={isSubscribed}
                onOpenAuth={() => {
                  setPendingPlansAfterAuth(false);
                  setAuthModalOpen(true);
                }}
                onLogout={handleLogout}
                onOpenAdmin={() => switchView('admin')}
                onNotify={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* FIXED BOTTOM NAVIGATION (5 BUTTONS ALWAYS VISIBLE - LIVE TV REPLACED BOTTOM SEARCH) */}
      <nav
        aria-label="Primary Navigation"
        className="fixed inset-x-0 bottom-0 z-[1200] grid h-16 grid-cols-5 border-t-2 border-[#6a0dad] bg-[#0a0712]/95 backdrop-blur-md"
      >
        {(
          [
            ['home', 'Home', Home],
            ['movies', 'Movies', Film],
            ['series', 'Series', Tv],
            ['livetv', 'Live TV', Radio],
            ['profile', 'Profile', User],
          ] as [AppView, string, typeof Home][]
        ).map(([viewKey, label, Icon]) => {
          const active = !isPaymentSuccessRoute && !isAdminRoute && currentView === viewKey;
          return (
            <button
              key={viewKey}
              type="button"
              onClick={() => switchView(viewKey)}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-semibold transition-colors ${
                active
                  ? 'bg-[#6a0dad]/35 text-[#f0cf65] border-t-2 border-[#d4af37]'
                  : 'text-white/75 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* MODALS */}
      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setPendingPlansAfterAuth(false);
          setPendingVipTitle(undefined);
          setAuthModalOpen(false);
        }}
        onSubmit={handleAuthSubmit}
      />

      <PlansModal
        open={plansModalOpen}
        plans={paymentPlans}
        onClose={() => setPlansModalOpen(false)}
        onSelectPlan={(plan) => {
          setPlansModalOpen(false);
          setPendingPlan(plan);
        }}
      />

      <VipPaymentPopupModal
        open={vipPopupOpen}
        itemTitle={vipPopupTitle}
        plans={paymentPlans}
        currentUser={state.currentUser}
        onClose={() => setVipPopupOpen(false)}
        onPayWithPesapal={(plan) => {
          setVipPopupOpen(false);
          setPendingPlan(plan);
        }}
        onPayWithWhatsapp={async (plan) => {
          setVipPopupOpen(false);
          if (state.currentUser?.phone && state.currentUser?.email) {
            const res = await recordWhatsappOrder(
              plan,
              state.currentUser.phone,
              state.currentUser.email,
              'WhatsApp',
              state.currentUser.name
            );
            if (!res.ok) {
              setPendingPlan(plan);
            }
          } else {
            setPendingPlan(plan);
          }
        }}
      />

      <MovieDetailsModal
        movie={detailsMovieId ? state.movies.find((m) => m.id === detailsMovieId) || null : null}
        season={detailsSeasonId ? state.seasons.find((s) => s.id === detailsSeasonId) || null : null}
        episodes={state.episodes}
        isSubscribed={isSubscribed}
        isAdmin={state.isAdminLoggedIn}
        likeCount={
          (detailsMovieId && state.likes[detailsMovieId]?.count) ||
          (detailsSeasonId && state.likes[detailsSeasonId]?.count) ||
          0
        }
        isLiked={Boolean(
          (detailsMovieId && state.likes[detailsMovieId]?.liked) ||
            (detailsSeasonId && state.likes[detailsSeasonId]?.liked)
        )}
        commentsCount={
          (detailsMovieId && (state.comments[detailsMovieId] || []).length) ||
          (detailsSeasonId && (state.comments[detailsSeasonId] || []).length) ||
          0
        }
        onClose={() => {
          setDetailsMovieId(null);
          setDetailsSeasonId(null);
        }}
        onWatchMovie={handleRequestWatchMovie}
        onDownloadMovie={handleRequestDownloadMovie}
        onWatchEpisode={handleRequestWatchEpisode}
        onDownloadEpisode={handleRequestDownloadEpisode}
        onLike={handleToggleLike}
        onShare={handleShareMovie}
        onOpenComments={(id) => setCommentsMovieId(id)}
      />

      <PesapalModal
        open={Boolean(pendingPlan)}
        onClose={() => setPendingPlan(null)}
        plan={pendingPlan}
        currentUser={state.currentUser}
        onManualWhatsappPayment={handleManualWhatsappPayment}
        onNotify={showToast}
      />

      <PlayerModal
        media={activePlayerMedia}
        canDownload={isSubscribed}
        onClose={() => setActivePlayerMedia(null)}
        onNotify={showToast}
        onRequireVipPay={() => {
          const title = activePlayerMedia?.title;
          setActivePlayerMedia(null);
          setVipPopupTitle(title);
          setVipPopupOpen(true);
        }}
      />

      <CommentsModal
        open={Boolean(commentsMovieId)}
        onClose={() => setCommentsMovieId(null)}
        movieTitle={activeCommentsTitle}
        comments={commentsMovieId ? state.comments[commentsMovieId] || [] : []}
        onPostComment={handlePostComment}
      />

      <InfoModal
        type={infoModalType}
        settings={state.settings}
        onNotify={showToast}
        onClose={() => setInfoModalType(null)}
      />

      <OfflineIndicator />
    </div>
  );
}
