import { useCallback, useEffect, useState } from 'react';
import { Film, Home, Radio, Search, Tv, User } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { HomeView, LiveTvView, MoviesView, ProfileView, SearchView, SeriesView } from './components/CustomerViews';
import { AuthModal, CommentsModal, InfoModal, PesapalModal, PlayerModal } from './components/Modals';
import { OfflineIndicator } from './components/PWAInstallButton';
import { BRAND_LOGO_URL, loadState, openMediaDB, resolveMediaUrl, saveState } from './storage';
import type { AppState, AppView, InfoModalType, LiveTvChannel, PendingPlan, PlayerMedia } from './types';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const [activePlayerMedia, setActivePlayerMedia] = useState<PlayerMedia | null>(null);
  const [commentsMovieId, setCommentsMovieId] = useState<string | null>(null);
  const [infoModalType, setInfoModalType] = useState<InfoModalType | null>(null);
  const [adminEditMovieId, setAdminEditMovieId] = useState<string | null>(null);
  const [adminEditChannelId, setAdminEditChannelId] = useState<string | null>(null);

  useEffect(() => {
    openMediaDB();
  }, []);

  useEffect(() => {
    document.title = state.settings.appName || 'VJ EMMA - TRUE LIGHT PRODUCTION';
  }, [state.settings.appName]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const switchView = useCallback(
    (viewName: AppView) => {
      if (viewName === 'admin' && !state.isAdminLoggedIn) {
        setAuthModalOpen(true);
        return;
      }
      setCurrentView(viewName);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [state.isAdminLoggedIn]
  );

  const liveCustomerAccount =
    state.currentUser && state.currentUser.role !== 'admin'
      ? state.users.find(
          (u) =>
            (state.currentUser?.id && u.id === state.currentUser.id) ||
            u.email.toLowerCase() === state.currentUser?.email.toLowerCase() ||
            u.phone === state.currentUser?.phone
        )
      : undefined;

  const isBlocked = Boolean(
    state.currentUser &&
      state.currentUser.role !== 'admin' &&
      (liveCustomerAccount?.status === 'blocked' || state.currentUser.status === 'blocked')
  );

  const isPendingApproval = Boolean(
    state.currentUser &&
      state.currentUser.role !== 'admin' &&
      !isBlocked &&
      liveCustomerAccount?.status === 'pending' &&
      !liveCustomerAccount?.subscribed
  );

  const isSubscribed = Boolean(
    state.isAdminLoggedIn ||
      (state.currentUser &&
        !isBlocked &&
        ((liveCustomerAccount
          ? liveCustomerAccount.subscribed && liveCustomerAccount.expiry > Date.now()
          : state.currentUser.subscribed && state.currentUser.expiry > Date.now())))
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
    setAuthModalOpen(true);
  };

  const handleAuthSubmit = (phone: string, email: string, password: string) => {
    if (!email || !password) {
      showToast('Enter Email and Password.');
      return;
    }

    const configuredAdminEmail = (state.adminEmail || '').trim().toLowerCase();
    const adminEmailMatches =
      !configuredAdminEmail || email.toLowerCase() === configuredAdminEmail;

    if (password === state.adminPassword && adminEmailMatches) {
      updateState((prev) => ({
        ...prev,
        isAdminLoggedIn: true,
        currentUser: {
          phone: phone || 'Admin',
          email,
          role: 'admin',
          subscribed: true,
          plan: 'VIP',
          expiry: Date.now() + 365 * 86400000,
        },
      }));
      setAuthModalOpen(false);
      showToast('Welcome Admin');
      setCurrentView('admin');
      return;
    }

    if (!phone) {
      showToast('Enter Phone, Email, and Password.');
      return;
    }

    const existing = state.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() || u.phone === phone
    );

    if (existing && existing.status === 'blocked') {
      showToast('Your account has been blocked by Admin.');
      return;
    }

    if (existing && existing.password && existing.password !== password) {
      showToast('Incorrect password.');
      return;
    }

    updateState((prev) => {
      const idx = prev.users.findIndex(
        (u) => u.email.toLowerCase() === email.toLowerCase() || u.phone === phone
      );
      let userRecord = idx !== -1 ? prev.users[idx] : null;
      let nextUsers = prev.users;

      if (!userRecord) {
        userRecord = {
          id: 'usr_' + Date.now(),
          phone,
          email,
          password,
          subscribed: false,
          plan: null,
          status: 'pending',
          expiry: 0,
          createdAt: Date.now(),
        };
        nextUsers = [...prev.users, userRecord];
      } else {
        userRecord = { ...userRecord, phone, email };
        nextUsers = prev.users.map((u, i) => (i === idx ? userRecord! : u));
      }

      return {
        ...prev,
        users: nextUsers,
        isAdminLoggedIn: false,
        currentUser: {
          id: userRecord.id,
          phone: userRecord.phone,
          email: userRecord.email,
          role: 'customer',
          subscribed: userRecord.subscribed,
          plan: userRecord.plan,
          status: userRecord.status,
          expiry: userRecord.expiry,
        },
      };
    });

    setAuthModalOpen(false);
    showToast('Signed in successfully.');
  };

  const handleLogout = () => {
    updateState((prev) => ({
      ...prev,
      currentUser: null,
      isAdminLoggedIn: false,
    }));
    showToast('Signed out.');
    setCurrentView('home');
  };

  const handlePesapalPayment = (phone: string, email: string, method: string) => {
    if (!phone || !email || !pendingPlan) {
      showToast('Enter client phone and email.');
      return;
    }

    const expiry = Date.now() + pendingPlan.days * 86400000;

    updateState((prev) => {
      const existingIdx = prev.users.findIndex(
        (u) => u.phone === phone || u.email.toLowerCase() === email.toLowerCase()
      );
      if (existingIdx !== -1 && prev.users[existingIdx].status === 'blocked') {
        return prev;
      }

      let nextUsers = [...prev.users];
      let userId = 'usr_' + Date.now();

      if (existingIdx === -1) {
        nextUsers.push({
          id: userId,
          phone,
          email,
          password: '',
          subscribed: true,
          plan: pendingPlan.planName,
          pendingPlan: null,
          pendingAmount: 0,
          pendingDays: 0,
          paymentMethod: `Pesapal (${method})`,
          status: 'approved',
          expiry,
          createdAt: Date.now(),
        });
      } else {
        userId = nextUsers[existingIdx].id;
        nextUsers[existingIdx] = {
          ...nextUsers[existingIdx],
          phone,
          email,
          subscribed: true,
          plan: pendingPlan.planName,
          pendingPlan: null,
          pendingAmount: 0,
          pendingDays: 0,
          paymentMethod: `Pesapal (${method})`,
          status: 'approved',
          expiry,
        };
      }

      const subscribedCount = nextUsers.filter((u) => u.subscribed).length;
      const nextTx = {
        id: 'tx_' + Date.now(),
        phone,
        email,
        plan: pendingPlan.planName,
        amount: Number(pendingPlan.amount),
        method: `Pesapal (${method})`,
        status: 'completed' as const,
        createdAt: Date.now(),
      };

      return {
        ...prev,
        users: nextUsers,
        clients: Math.max(prev.clients, subscribedCount),
        wallet: prev.wallet + Number(pendingPlan.amount),
        walletTransactions: [nextTx, ...(prev.walletTransactions || [])],
        currentUser: prev.currentUser
          ? {
              ...prev.currentUser,
              subscribed: true,
              plan: pendingPlan.planName,
              status: 'approved',
              expiry,
            }
          : {
              id: userId,
              phone,
              email,
              role: 'customer',
              subscribed: true,
              plan: pendingPlan.planName,
              status: 'approved',
              expiry,
            },
      };
    });

    const paidPhone = phone;
    setPendingPlan(null);
    showToast(`Pesapal Paid (${method})! WhatsApp message sent automatically to ${paidPhone}`);
  };

  const handleManualWhatsappPayment = (phone: string, email: string, method: string) => {
    if (!phone || !email || !pendingPlan) {
      showToast('Enter your phone number and email first.');
      return;
    }

    const existingBlocked = state.users.find(
      (u) => (u.phone === phone || u.email.toLowerCase() === email.toLowerCase()) && u.status === 'blocked'
    );
    if (existingBlocked) {
      showToast('This account has been blocked by Admin.');
      return;
    }

    updateState((prev) => {
      const existingIdx = prev.users.findIndex(
        (u) => u.phone === phone || u.email.toLowerCase() === email.toLowerCase()
      );
      const nextUsers = [...prev.users];
      let userId = 'usr_' + Date.now();

      if (existingIdx === -1) {
        nextUsers.push({
          id: userId,
          phone,
          email,
          password: '',
          subscribed: false,
          plan: null,
          pendingPlan: pendingPlan.planName,
          pendingAmount: Number(pendingPlan.amount),
          pendingDays: pendingPlan.days,
          paymentMethod: `Manual WhatsApp (${method})`,
          status: 'pending',
          expiry: 0,
          createdAt: Date.now(),
        });
      } else {
        userId = nextUsers[existingIdx].id;
        nextUsers[existingIdx] = {
          ...nextUsers[existingIdx],
          phone,
          email,
          pendingPlan: pendingPlan.planName,
          pendingAmount: Number(pendingPlan.amount),
          pendingDays: pendingPlan.days,
          paymentMethod: `Manual WhatsApp (${method})`,
          status: nextUsers[existingIdx].subscribed ? 'approved' : 'pending',
        };
      }

      const nextTx = {
        id: 'tx_' + Date.now(),
        phone,
        email,
        plan: pendingPlan.planName,
        amount: Number(pendingPlan.amount),
        method: `Manual WhatsApp (${method})`,
        status: 'pending' as const,
        createdAt: Date.now(),
      };

      return {
        ...prev,
        users: nextUsers,
        walletTransactions: [nextTx, ...(prev.walletTransactions || [])],
        currentUser: prev.currentUser
          ? {
              ...prev.currentUser,
              status: prev.currentUser.subscribed ? 'approved' : 'pending',
            }
          : {
              id: userId,
              phone,
              email,
              role: 'customer',
              subscribed: false,
              plan: null,
              status: 'pending',
              expiry: 0,
            },
      };
    });

    showToast('Manual WhatsApp request submitted! Pending Admin approval.');
  };

  const guardPlaybackAccess = (label: string): boolean => {
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
      showToast(`Please subscribe first to watch ${label}.`);
      switchView('profile');
      return false;
    }
    return true;
  };

  const handleRequestWatchMovie = async (movieId: string) => {
    if (!guardPlaybackAccess('movies')) return;
    const m = state.movies.find((x) => x.id === movieId);
    if (!m) return;
    const url = await resolveMediaUrl(m.video);
    if (!url) {
      showToast('No video source attached to this title.');
      return;
    }
    setActivePlayerMedia({
      title: m.title,
      videoUrl: url,
      description: m.description || '',
      fileName: `${(m.title || 'movie').replace(/[^a-zA-Z0-9._-]/g, '_')}.mp4`,
    });
  };

  const handleRequestWatchEpisode = async (episodeId: string) => {
    if (!guardPlaybackAccess('episodes')) return;
    const ep = state.episodes.find((x) => x.id === episodeId);
    if (!ep) return;
    const url = await resolveMediaUrl(ep.video);
    if (!url) {
      showToast('No video source attached to this episode.');
      return;
    }
    setActivePlayerMedia({
      title: `Ep ${ep.episodeNumber}: ${ep.title}`,
      videoUrl: url,
      description: '',
      fileName: `${(ep.title || 'episode').replace(/[^a-zA-Z0-9._-]/g, '_')}.mp4`,
    });
  };

  const handleRequestWatchLiveTv = (channel: LiveTvChannel) => {
    if (!guardPlaybackAccess('Live TV')) return;
    if (!channel.streamUrl) {
      showToast('No Live TV stream link attached to this channel.');
      return;
    }
    setActivePlayerMedia({
      title: `${channel.name} (LIVE TV)`,
      videoUrl: channel.streamUrl,
      description: channel.category ? `Live Broadcast · ${channel.category}` : 'Live Broadcast',
      fileName: `${(channel.name || 'livetv').replace(/[^a-zA-Z0-9._-]/g, '_')}.mp4`,
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
      <header className="fixed inset-x-0 top-0 z-[900] flex h-16 items-center justify-between gap-3 border-b-2 border-[#6a0dad]/80 bg-gradient-to-r from-[#050507] via-[#130820] to-[#050507] px-3.5 backdrop-blur-md">
        <button
          type="button"
          onClick={() => switchView('home')}
          className="flex min-w-0 items-center gap-2.5 text-left"
        >
          <img
            src={BRAND_LOGO_URL}
            alt="VJ EMMA Logo"
            referrerPolicy="no-referrer"
            className="h-11 w-11 shrink-0 rounded-full border-2 border-[#d4af37] bg-[#050507] object-cover shadow"
          />
          <span className="truncate font-brand text-xl font-bold tracking-[0.06em] text-[#f0cf65]">
            {brandTitle}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => switchView('search')}
            aria-label="Search movies and series"
            className={`flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95 ${
              currentView === 'search'
                ? 'border-[#d4af37] bg-[#d4af37] text-black'
                : 'border-[#6a0dad] bg-[#140d22] text-white hover:border-[#d4af37]'
            }`}
          >
            <Search className="h-4 w-4" />
            <span>Search</span>
          </button>

          <button
            type="button"
            onClick={handleHeaderAction}
            className="min-h-[40px] shrink-0 whitespace-nowrap rounded-full border border-[#d4af37] bg-gradient-to-r from-[#6a0dad] to-[#4a077a] px-4 py-1.5 text-xs font-semibold text-white shadow transition-transform active:scale-95"
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
        {currentView === 'home' && (
          <HomeView
            state={state}
            onWatchMovie={handleRequestWatchMovie}
            onLikeMovie={handleToggleLike}
            onShareMovie={handleShareMovie}
            onOpenComments={(id) => setCommentsMovieId(id)}
            onOpenInfo={(type) => setInfoModalType(type)}
            onNotify={showToast}
            onAdminEditMovie={handleAdminEditMovie}
            onAdminDeleteMovie={handleAdminDeleteMovie}
          />
        )}

        {currentView === 'movies' && (
          <MoviesView
            state={state}
            onWatchMovie={handleRequestWatchMovie}
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
            onWatchEpisode={handleRequestWatchEpisode}
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
            onWatchMovie={handleRequestWatchMovie}
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
            onOpenAuth={() => setAuthModalOpen(true)}
            onLogout={handleLogout}
            onOpenAdmin={() => switchView('admin')}
            onSelectPlan={(plan) => setPendingPlan(plan)}
            onNotify={showToast}
          />
        )}

        {currentView === 'admin' && state.isAdminLoggedIn && (
          <AdminPanel
            state={state}
            updateState={updateState}
            onViewSite={() => switchView('home')}
            onLogout={handleLogout}
            onNotify={showToast}
            initialEditMovieId={adminEditMovieId}
            onClearInitialEditMovie={() => setAdminEditMovieId(null)}
            initialEditChannelId={adminEditChannelId}
            onClearInitialEditChannel={() => setAdminEditChannelId(null)}
          />
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
          const active = currentView === viewKey;
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
        onClose={() => setAuthModalOpen(false)}
        onSubmit={handleAuthSubmit}
      />

      <PesapalModal
        open={Boolean(pendingPlan)}
        onClose={() => setPendingPlan(null)}
        plan={pendingPlan}
        currentUser={state.currentUser}
        onCompletePayment={handlePesapalPayment}
        onManualWhatsappPayment={handleManualWhatsappPayment}
      />

      <PlayerModal
        media={activePlayerMedia}
        canDownload={isSubscribed}
        onClose={() => setActivePlayerMedia(null)}
        onNotify={showToast}
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
