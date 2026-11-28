import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  Download,
  Maximize2,
  Minimize2,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Crown,
  Lock,
  Clock,
  Calendar,
  Users,
  Film,
  Heart,
  Share2,
} from 'lucide-react';
import { checkAdminServerStatus } from '../d1Client';
import {
  getSocialPlatformItems,
  isVipLabel,
  normalizeSocialUrl,
  parseMovieGenres,
  useResolvedMedia,
  WHATSAPP_ADMIN_PHONE,
  WHATSAPP_DISPLAY_PHONE,
} from '../storage';
import type {
  AppSettings,
  CommentItem,
  Episode,
  InfoModalType,
  Movie,
  PaymentPlan,
  PendingPlan,
  PlayerMedia,
  Season,
  SessionUser,
} from '../types';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  title,
  maxWidthClass = 'max-w-[500px]',
  children,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 p-4 pb-20 overflow-y-auto backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[84vh] overflow-y-auto rounded-2xl border border-[#d4af37]/70 bg-[#111018] p-5 shadow-2xl`}
      >
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="font-display text-lg font-bold text-[#d4af37]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-2 focus-visible:outline-[#d4af37]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (phone: string, email: string, password: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onSubmit }) => {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) {
      setPassword('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(phone.trim(), email.trim(), password);
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Sign In">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">
            Phone Number <span className="font-normal text-white/60">(Required for customers)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+256700000000"
            className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2.5 text-sm font-extrabold text-black transition-transform active:scale-[0.98]"
        >
          Sign In
        </button>
      </form>
    </ModalShell>
  );
};

function openWhatsappTab(whatsappHref: string): void {
  const link = document.createElement('a');
  link.href = whatsappHref;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface AdminLoginPageProps {
  onSubmit: (email: string, password: string) => Promise<void> | void;
  onReturnSite: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onSubmit, onReturnSite }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsFirstSetup, setNeedsFirstSetup] = useState(false);

  useEffect(() => {
    let active = true;
    checkAdminServerStatus().then((st) => {
      if (active) setNeedsFirstSetup(!st.configured);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[460px] px-4 py-10">
      <div className="rounded-2xl border-2 border-[#d4af37]/70 bg-[#111018] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2.5 border-b border-white/10 pb-3">
          <ShieldCheck className="h-6 w-6 text-[#d4af37]" />
          <div>
            <h1 className="font-display text-lg font-extrabold text-[#f0cf65]">
              Admin Sign In
            </h1>
            <p className="text-xs text-white/70">
              Restricted to authorized Admin only.
            </p>
          </div>
        </div>

        {needsFirstSetup && (
          <div className="mb-3 rounded-lg border border-[#d4af37]/50 bg-[#1d1330] px-3 py-2 text-xs text-[#f0cf65]">
            First-time setup: your Admin password will be saved securely in Cloudflare D1.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">
              Admin Username or Email
            </label>
            <input
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin or piwantonny@gmail.com"
              required
              className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2.5 text-sm font-extrabold text-black transition-transform active:scale-[0.98] disabled:opacity-65"
          >
            {submitting ? 'Signing In...' : 'Sign In to Admin'}
          </button>
          <button
            type="button"
            onClick={onReturnSite}
            className="flex min-h-[40px] w-full items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:text-white"
          >
            Back to Site
          </button>
        </form>
      </div>
    </div>
  );
};

interface PlansModalProps {
  open: boolean;
  plans: PaymentPlan[];
  onClose: () => void;
  onSelectPlan: (plan: PendingPlan) => void;
}

export const PlansModal: React.FC<PlansModalProps> = ({
  open,
  plans,
  onClose,
  onSelectPlan,
}) => {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Choose Subscription Plan"
      maxWidthClass="max-w-[760px]"
    >
      <p className="mb-4 text-sm text-white/85">
        Subscribe to watch &amp; download Luo movies, series, and Live TV. Pay via Manual WhatsApp ({WHATSAPP_DISPLAY_PHONE}).
      </p>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {plans.map((planItem, idx) => {
          const isFeatured = idx === plans.length - 1 && plans.length > 1;
          return (
            <div
              key={planItem.id}
              className={`flex flex-col gap-2.5 rounded-xl border-2 p-4 ${
                isFeatured
                  ? 'border-[#d4af37] bg-gradient-to-b from-[#6a0dad]/40 to-[#110e1a]'
                  : 'border-[#6a0dad] bg-[#0b0912]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-base font-bold text-[#f0cf65]">
                  {planItem.name}
                </div>
                {isFeatured && <Crown className="h-4 w-4 text-[#d4af37]" />}
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                UGX {Number(planItem.price).toLocaleString()}
              </div>
              <p className="text-xs leading-relaxed text-white/80">
                {planItem.days} {planItem.days === 1 ? 'Day' : 'Days'} unlimited streaming &amp; downloads.
              </p>
              <button
                type="button"
                onClick={() =>
                  onSelectPlan({
                    planName: planItem.name,
                    amount: Number(planItem.price),
                    days: Number(planItem.days),
                  })
                }
                className="mt-auto min-h-[44px] w-full rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-3 py-2 text-xs font-black uppercase tracking-wide text-black transition-transform active:scale-[0.98]"
              >
                PAY / BOOK NOW
              </button>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
};

interface WhatsappCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  plan: PendingPlan | null;
  currentUser: SessionUser | null;
  onManualWhatsappPayment: (
    phone: string,
    email: string,
    method: string,
    name?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onNotify: (msg: string) => void;
}

export const WhatsappCheckoutModal: React.FC<WhatsappCheckoutModalProps> = ({
  open,
  onClose,
  plan,
  currentUser,
  onManualWhatsappPayment,
  onNotify,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : ''));
      setPhone(currentUser?.phone || '');
      setEmail(currentUser?.email || '');
      setManualSubmitted(false);
      setManualSubmitting(false);
      setErrorMsg(null);
    }
  }, [open, currentUser]);

  const whatsappMessage = plan
    ? `Hello VJ EMMA - TRUE LIGHT PRODUCTION, I am paying via WhatsApp for the ${plan.planName} Plan (UGX ${Number(plan.amount).toLocaleString()} / ${plan.days} days). Name: ${name.trim()}, Phone: ${phone.trim()}, Email: ${email.trim()}. Please approve my account.`
    : '';
  const whatsappHref = `https://wa.me/${WHATSAPP_ADMIN_PHONE}?text=${encodeURIComponent(whatsappMessage)}`;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    if (!cleanName || !cleanPhone) {
      const msg = 'Enter your full name and phone number first.';
      setErrorMsg(msg);
      onNotify(msg);
      return;
    }

    setManualSubmitting(true);
    setErrorMsg(null);
    setManualSubmitted(false);
    try {
      const res = await onManualWhatsappPayment(cleanPhone, cleanEmail, 'whatsapp', cleanName);
      if (res.ok) {
        setManualSubmitted(true);
        openWhatsappTab(whatsappHref);
      } else {
        setManualSubmitted(false);
        setErrorMsg(res.error || 'Could not save payment request to Cloudflare D1.');
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Pay via WhatsApp">
      {plan && (
        <div className="mb-4 rounded-xl border border-[#6a0dad]/45 bg-[#08070d] p-3.5">
          <div className="text-sm font-extrabold text-[#d4af37]">{plan.planName} Plan</div>
          <div className="mt-1 text-xl font-black text-white tabular-nums">
            UGX {Number(plan.amount).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-[#b0aab8]">
            Validity: {plan.days} {plan.days === 1 ? 'Day' : 'Days'} · Send payment to {WHATSAPP_DISPLAY_PHONE}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-3 rounded-lg border border-rose-500/60 bg-rose-950/60 px-3 py-2 text-xs font-semibold text-rose-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="space-y-3.5">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">
            Client Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">
            Client Phone Number (for WhatsApp confirmation)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setManualSubmitted(false);
            }}
            placeholder="+2567XXXXXXXX"
            className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">
            Client Email <span className="font-normal text-white/60">(Optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setManualSubmitted(false);
            }}
            placeholder="client@example.com"
            className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
          />
        </div>

        {!manualSubmitted ? (
          <button
            type="submit"
            disabled={manualSubmitting}
            className="mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/70 bg-emerald-700 px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white transition-transform active:scale-[0.98] disabled:opacity-65"
          >
            {manualSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving request to D1...</span>
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                <span>Pay Manually with WhatsApp</span>
              </>
            )}
          </button>
        ) : (
          <div className="space-y-2.5 pt-1">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 p-2.5 text-xs font-semibold text-emerald-200">
              Saved as Pending Approval in Cloudflare D1! WhatsApp opened — send your confirmation message so Admin can approve your access.
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Open WhatsApp ({WHATSAPP_DISPLAY_PHONE})</span>
            </a>
          </div>
        )}
      </form>
    </ModalShell>
  );
};

interface VipPaymentPopupModalProps {
  open: boolean;
  itemTitle?: string;
  plans: PaymentPlan[];
  currentUser: SessionUser | null;
  onClose: () => void;
  onPayWithWhatsapp: (plan: PendingPlan) => Promise<{ ok: boolean; needsForm?: boolean; error?: string }>;
}

export const VipPaymentPopupModal: React.FC<VipPaymentPopupModalProps> = ({
  open,
  itemTitle,
  plans,
  currentUser,
  onClose,
  onPayWithWhatsapp,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [waSubmitting, setWaSubmitting] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || plans.length === 0) return;
    const vipPlan =
      plans.find((p) => p.name.toLowerCase().includes('vip')) || plans[plans.length - 1] || plans[0];
    setSelectedPlanId(vipPlan.id);
    setWaSubmitting(false);
    setWaError(null);
  }, [open, plans]);

  const activePlan =
    plans.find((p) => p.id === selectedPlanId) ||
    plans.find((p) => p.name.toLowerCase().includes('vip')) ||
    plans[0];

  const pendingSelected: PendingPlan | null = activePlan
    ? {
        planName: activePlan.name,
        amount: Number(activePlan.price),
        days: Number(activePlan.days || 1),
      }
    : null;

  const whatsappText = pendingSelected
    ? `Hello VJ EMMA - TRUE LIGHT PRODUCTION, I want to pay for ${pendingSelected.planName} Plan (UGX ${Number(pendingSelected.amount).toLocaleString()} / ${pendingSelected.days} days) to Watch / Download${itemTitle ? ` "${itemTitle}"` : ' VIP Movie'}. Name: ${currentUser?.name || currentUser?.email || 'Customer'}, Phone: ${currentUser?.phone || ''}, Email: ${currentUser?.email || ''}.`
    : 'Hello VJ EMMA, I want to pay for VIP access.';

  const whatsappHref = `https://wa.me/${WHATSAPP_ADMIN_PHONE}?text=${encodeURIComponent(whatsappText)}`;

  const handleVipWhatsappClick = async () => {
    if (!pendingSelected) return;
    setWaSubmitting(true);
    setWaError(null);
    try {
      const res = await onPayWithWhatsapp(pendingSelected);
      if (res.ok && !res.needsForm) {
        openWhatsappTab(whatsappHref);
      } else if (!res.ok && !res.needsForm) {
        setWaError(res.error || 'Could not save payment request to D1.');
      }
    } finally {
      setWaSubmitting(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="VIP Access Required" maxWidthClass="max-w-[540px]">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border-2 border-[#d4af37] bg-gradient-to-br from-[#2a0c4a] via-[#170b28] to-[#0b0812] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#f0cf65] text-black shadow">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-sm font-black text-[#f0cf65] sm:text-base">
              This is VIP Movie. You need to pay to Watch / Download
            </div>
            {itemTitle && (
              <p className="mt-1 text-xs font-semibold text-white/85">
                Selected Title: <span className="text-[#d4af37]">{itemTitle}</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#f0cf65]">
            Choose Price Plan
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {plans.map((planItem) => {
              const isSelected = activePlan?.id === planItem.id;
              return (
                <button
                  key={planItem.id}
                  type="button"
                  onClick={() => setSelectedPlanId(planItem.id)}
                  className={`flex flex-col items-start rounded-xl border-2 p-3 text-left transition-all ${
                    isSelected
                      ? 'border-[#d4af37] bg-[#6a0dad]/40 shadow-lg'
                      : 'border-[#6a0dad]/50 bg-[#0b0912] hover:border-[#d4af37]/60'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="font-display text-sm font-extrabold text-[#f0cf65]">
                      {planItem.name}
                    </span>
                    {planItem.name.toLowerCase().includes('vip') && (
                      <Crown className="h-3.5 w-3.5 text-[#d4af37]" />
                    )}
                  </div>
                  <div className="mt-1 text-base font-black text-white tabular-nums">
                    UGX {Number(planItem.price).toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-white/75">
                    {planItem.days} {planItem.days === 1 ? 'Day' : 'Days'} Access
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {pendingSelected && (
          <div className="rounded-lg border border-[#6a0dad]/50 bg-[#08070d] px-3 py-2 text-xs text-white/85">
            Selected Plan:{' '}
            <span className="font-bold text-[#f0cf65]">
              {pendingSelected.planName} — UGX {Number(pendingSelected.amount).toLocaleString()} ({pendingSelected.days}{' '}
              {pendingSelected.days === 1 ? 'Day' : 'Days'})
            </span>
          </div>
        )}

        {waError && (
          <div className="rounded-lg border border-rose-500/60 bg-rose-950/60 px-3 py-2 text-xs font-semibold text-rose-200">
            {waError}
          </div>
        )}

        <div>
          <button
            type="button"
            disabled={!pendingSelected || waSubmitting}
            onClick={handleVipWhatsappClick}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/70 bg-emerald-700 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow transition-transform active:scale-[0.98] disabled:opacity-65"
          >
            {waSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving to D1...</span>
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                <span>Pay Manually with WhatsApp</span>
              </>
            )}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

interface MovieDetailsModalProps {
  movie: Movie | null;
  season: Season | null;
  episodes: Episode[];
  isSubscribed: boolean;
  isAdmin: boolean;
  likeCount: number;
  isLiked: boolean;
  commentsCount: number;
  onClose: () => void;
  onWatchMovie: (movieId: string) => void;
  onDownloadMovie: (movieId: string) => void;
  onWatchEpisode: (episodeId: string) => void;
  onDownloadEpisode: (episodeId: string) => void;
  onLike: (id: string) => void;
  onShare: (id: string) => void;
  onOpenComments: (id: string) => void;
}

export const MovieDetailsModal: React.FC<MovieDetailsModalProps> = ({
  movie,
  season,
  episodes,
  isSubscribed,
  isAdmin,
  likeCount,
  isLiked,
  commentsCount,
  onClose,
  onWatchMovie,
  onDownloadMovie,
  onWatchEpisode,
  onDownloadEpisode,
  onLike,
  onShare,
  onOpenComments,
}) => {
  const activeItem = movie || season;
  const posterSrc = useResolvedMedia(activeItem?.poster);

  if (!activeItem) return null;

  const isVip = isVipLabel(activeItem.label);
  const isVipLocked = isVip && !isSubscribed && !isAdmin;
  const displayTitle = movie
    ? movie.title
    : `${season!.seriesTitle} — Season ${season!.seasonNumber}`;
  const genres = movie
    ? parseMovieGenres(movie.genres, movie.genre, movie.categories, movie.category)
    : parseMovieGenres(season?.genres, season?.genre, season?.categories, season?.category);
  const year = movie ? movie.year : season?.year;
  const duration = movie ? movie.duration : season?.duration;
  const actors = movie ? movie.actors : season?.actors;
  const description = movie ? movie.description : season?.description;
  const seasonEpisodes = season
    ? episodes
        .filter((ep) => ep.seasonId === season.id)
        .sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber))
    : [];

  return (
    <ModalShell
      open={Boolean(activeItem)}
      onClose={onClose}
      title={movie ? 'Movie Details' : 'Series Details'}
      maxWidthClass="max-w-[700px]"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative aspect-[2/3] w-40 shrink-0 self-center overflow-hidden rounded-xl border-2 border-[#d4af37]/70 bg-[#181228] sm:w-48 sm:self-start">
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={displayTitle}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#2b0c4e] via-[#150b24] to-[#08060c] p-3 text-center">
              <Film className="h-8 w-8 text-[#d4af37]" />
              <span className="font-display text-xs font-bold text-white">{displayTitle}</span>
            </div>
          )}
          {isVip && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded border border-[#f0cf65] bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow">
              {isVipLocked && <Lock className="h-3 w-3" />}
              <span>VIP</span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="font-display text-xl font-extrabold text-white">{displayTitle}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {year && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#d4af37]/50 bg-[#1a1326] px-2 py-1 font-bold text-[#f0cf65] tabular-nums">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{year}</span>
                </span>
              )}
              {duration && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#6a0dad]/70 bg-[#140e22] px-2 py-1 font-bold text-white">
                  <Clock className="h-3.5 w-3.5 text-[#d4af37]" />
                  <span>{duration}</span>
                </span>
              )}
              {movie?.rating && (
                <span className="inline-flex items-center rounded-md border border-[#d4af37]/50 bg-black/70 px-2 py-1 font-extrabold text-[#d4af37]">
                  ★ {movie.rating}
                </span>
              )}
            </div>
          </div>

          {genres.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#f0cf65]">
                Genres
              </div>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-md border border-[#6a0dad] bg-[#6a0dad]/35 px-2.5 py-0.5 text-[11px] font-bold text-white"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {actors && (
            <div className="rounded-lg border border-white/10 bg-[#0a0812] p-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#f0cf65]">
                <Users className="h-3.5 w-3.5" />
                <span>Actors Names</span>
              </div>
              <p className="text-xs font-medium text-white/90">{actors}</p>
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-[#0a0812] p-2.5">
            <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-[#f0cf65]">
              Description
            </div>
            <p className="text-xs leading-relaxed text-[#e0d8ef]">
              {description || 'No description added yet.'}
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-white/15 overflow-hidden rounded-lg border border-[#6a0dad]/60 bg-[#0b0714]">
            <button
              type="button"
              onClick={() => onLike(activeItem.id)}
              className={`flex min-h-[38px] items-center justify-center gap-1 text-xs font-bold ${
                isLiked ? 'text-[#d4af37]' : 'text-white'
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-[#d4af37]' : ''}`} />
              <span>{likeCount}</span>
            </button>
            <button
              type="button"
              onClick={() => onShare(activeItem.id)}
              className="flex min-h-[38px] items-center justify-center gap-1 text-xs font-bold text-white"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenComments(activeItem.id)}
              className="flex min-h-[38px] items-center justify-center gap-1 text-xs font-bold text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{commentsCount}</span>
            </button>
          </div>

          {movie && (
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onWatchMovie(movie.id)}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#f0cf65] to-[#d4af37] px-4 py-2 text-xs font-black text-black shadow"
              >
                {isVipLocked ? <Lock className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                <span>{isVipLocked ? 'VIP · Pay to Watch' : 'Watch Now'}</span>
              </button>
              <button
                type="button"
                onClick={() => onDownloadMovie(movie.id)}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-extrabold text-white shadow"
              >
                {isVipLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                <span>{isVipLocked ? 'VIP · Pay to Download' : 'Download'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {season && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#f0cf65]">
            Episodes ({seasonEpisodes.length})
          </div>
          {seasonEpisodes.length === 0 ? (
            <p className="text-xs text-white/70">No episodes added to this season yet.</p>
          ) : (
            <div className="space-y-2">
              {seasonEpisodes.map((ep) => (
                <div
                  key={ep.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#6a0dad]/50 bg-[#09070f] px-3 py-2"
                >
                  <div className="text-xs font-bold text-white sm:text-sm">
                    Ep {ep.episodeNumber}: {ep.title}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onWatchEpisode(ep.id)}
                      className="flex min-h-[38px] items-center gap-1 rounded-md bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-3 py-1.5 text-xs font-black text-black"
                    >
                      {isVipLocked ? <Lock className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                      <span>Watch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownloadEpisode(ep.id)}
                      className="flex min-h-[38px] items-center gap-1 rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {isVipLocked ? <Lock className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
};

interface PlayerModalProps {
  media: PlayerMedia | null;
  canDownload?: boolean;
  onClose: () => void;
  onNotify: (msg: string) => void;
  onRequireVipPay?: () => void;
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        return url;
      }
      if (parsed.pathname.startsWith('/live/')) {
        const id = parsed.pathname.split('/live/')[1]?.split('/')[0];
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null;
      }
      const v = parsed.searchParams.get('v');
      if (v) {
        return `https://www.youtube.com/embed/${v}?autoplay=1`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isDirectVideoFile(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('idb://') || url.startsWith('blob:') || url.startsWith('data:')) return true;
  if (/workers\.dev|r2\.dev/i.test(url)) return true;
  return /\.(mp4|mkv|avi|mov|webm|m4v|flv|wmv|3gp|ts|ogg|ogv|mpeg|mpg|m3u8)(\?|#|$)/i.test(url);
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  media,
  canDownload = false,
  onClose,
  onNotify,
  onRequireVipPay,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoPlaybackError, setVideoPlaybackError] = useState(false);

  const ytEmbed = media ? getYouTubeEmbedUrl(media.videoUrl) : null;
  const useIframe = Boolean(media && (ytEmbed || (media.isLive && !isDirectVideoFile(media.videoUrl))));
  const iframeSrc = ytEmbed || media?.videoUrl || '';

  useEffect(() => {
    setVideoPlaybackError(false);
    if (!media) {
      setEnlarged(false);
      setIsPlaying(false);
      return;
    }
    if (useIframe) {
      setIsPlaying(true);
      return;
    }
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [media, useIframe]);

  const handleClose = () => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setEnlarged(false);
    setVideoPlaybackError(false);
    onClose();
  };

  const togglePlay = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoEl.pause();
      setIsPlaying(false);
    }
  };

  const handleDownload = () => {
    if (!canDownload) {
      onNotify('This is VIP Movie. You need to pay to Watch / Download.');
      onRequireVipPay?.();
      return;
    }
    if (!media?.videoUrl) {
      onNotify('Download unavailable.');
      return;
    }
    const a = document.createElement('a');
    a.href = media.videoUrl;
    a.download = media.fileName || 'vj-emma-video.mp4';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onNotify('Starting download...');
  };

  const toggleEnlarge = () => {
    const next = !enlarged;
    setEnlarged(next);
    const wrapper = wrapperRef.current;
    if (next && wrapper?.requestFullscreen) {
      wrapper.requestFullscreen().catch(() => {});
    } else if (!next && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!media) return null;

  if (!canDownload) {
    return (
      <ModalShell open={Boolean(media)} onClose={handleClose} title={media.title} maxWidthClass="max-w-[520px]">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[#d4af37]/60 bg-[#08070d] p-6 text-center">
          <Lock className="h-10 w-10 text-[#d4af37]" />
          <div className="font-display text-base font-bold text-[#f0cf65]">
            This is VIP Movie. You need to pay to Watch / Download
          </div>
          <p className="text-xs leading-relaxed text-white/80">
            Watching and downloading are locked until your payment is completed.
          </p>
          {onRequireVipPay && (
            <button
              type="button"
              onClick={() => {
                handleClose();
                onRequireVipPay();
              }}
              className="mt-1 min-h-[44px] rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-5 py-2 text-xs font-black uppercase text-black"
            >
              View Payment Plans
            </button>
          )}
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell open={Boolean(media)} onClose={handleClose} title={media.title} maxWidthClass="max-w-[760px]">
      <div
        ref={wrapperRef}
        className={
          enlarged
            ? 'fixed inset-0 z-[1500] flex flex-col justify-center bg-black'
            : 'relative w-full overflow-hidden rounded-xl border border-[#d4af37] bg-black'
        }
      >
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex select-none items-center gap-1.5 rounded-md border border-[#d4af37]/60 bg-black/65 px-2.5 py-1 text-xs font-black tracking-widest text-[#d4af37]">
          {media.isLive && (
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
          <span>{media.isLive ? 'LIVE · VJ EMMA' : 'VJ EMMA'}</span>
        </div>

        {useIframe ? (
          <iframe
            src={iframeSrc}
            title={media.title}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            className={
              enlarged
                ? 'h-full max-h-[calc(100vh-68px)] w-full border-0 bg-black'
                : 'aspect-video w-full border-0 bg-black'
            }
          />
        ) : (
          <video
            ref={videoRef}
            src={media.videoUrl}
            controls
            playsInline
            preload="metadata"
            onPlay={() => {
              setVideoPlaybackError(false);
              setIsPlaying(true);
            }}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              setVideoPlaybackError(true);
              setIsPlaying(false);
            }}
            className={enlarged ? 'h-full max-h-[calc(100vh-68px)] w-full bg-black' : 'block max-h-[56vh] w-full bg-black'}
          />
        )}

        {videoPlaybackError && !useIframe && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/40 bg-amber-950/70 px-3 py-2 text-xs text-amber-100">
            <span>
              Browser could not decode this video format directly. Tap Download to save &amp; play offline.
            </span>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-md bg-[#d4af37] px-3 py-1 font-extrabold text-black"
            >
              Download Video
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-[#d4af37]/25 bg-[#0c0a12] p-2.5">
          {!useIframe && (
            <button
              type="button"
              onClick={togglePlay}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black whitespace-nowrap"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
          )}
          {!media.isLive && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-bold text-white whitespace-nowrap"
            >
              {canDownload ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span>Download</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleEnlarge}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-bold text-white whitespace-nowrap"
          >
            {enlarged ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{enlarged ? 'Shrink' : 'Enlarge'}</span>
          </button>
        </div>
      </div>
      {media.description && (
        <p className="mt-3 text-sm leading-relaxed text-[#b0aab8]">{media.description}</p>
      )}
    </ModalShell>
  );
};

interface CommentsModalProps {
  open: boolean;
  onClose: () => void;
  movieTitle: string;
  comments: CommentItem[];
  onPostComment: (text: string) => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  open,
  onClose,
  movieTitle,
  comments,
  onPostComment,
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onPostComment(trimmed);
    setText('');
  };

  return (
    <ModalShell open={open} onClose={onClose} title={movieTitle ? `Comments: ${movieTitle}` : 'Comments'}>
      <div className="mb-3 max-h-[240px] space-y-2 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-sm text-[#b0aab8]">
            <MessageSquare className="h-4 w-4 text-[#d4af37]" />
            <span>No comments yet. Be the first to comment!</span>
          </div>
        ) : (
          comments.map((c, idx) => (
            <div
              key={`${c.time}-${idx}`}
              className="rounded-lg border border-[#6a0dad]/35 bg-[#08070d] p-2.5"
            >
              <div className="text-[11px] font-bold text-[#d4af37]">
                {c.author} · {new Date(c.time).toLocaleDateString()}
              </div>
              <div className="mt-1 text-sm text-white">{c.text}</div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your comment..."
          className="min-h-[76px] w-full resize-y rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none"
        />
        <button
          type="submit"
          className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-sm font-extrabold text-black"
        >
          Post Comment
        </button>
      </form>
    </ModalShell>
  );
};

interface InfoModalProps {
  type: InfoModalType | null;
  settings?: AppSettings;
  onNotify?: (msg: string) => void;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ type, settings, onNotify, onClose }) => {
  const content: Record<InfoModalType, { title: string; body: string }> = {
    about: {
      title: 'About Us',
      body: 'VJ EMMA - TRUE LIGHT PRODUCTION brings the world home in Luo. We deliver translated movies, Christian films, series, and professional media services including Photography, Videography, Documentary, Secretary, and Computer Training.',
    },
    contacts: {
      title: 'Contacts',
      body: 'Reach VJ EMMA - TRUE LIGHT PRODUCTION (T.L.S.P) for subscriptions, media production, and training inquiries on WhatsApp (0776043203), YouTube, Facebook, or TikTok, or visit vjemma.site.',
    },
    terms: {
      title: 'Terms of Service',
      body: 'All content streamed on VJ EMMA - TRUE LIGHT PRODUCTION is for personal viewing only. An active Weekly, Monthly, or VIP subscription is required prior to playback.',
    },
    privacy: {
      title: 'Privacy Policy',
      body: 'We value your privacy. Your phone number and email are used strictly for account access, subscription verification, and WhatsApp payment confirmation.',
    },
  };

  const active = type ? content[type] : null;
  const socialPlatforms = getSocialPlatformItems(settings);
  const extraSocials = (settings?.socialLinks || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <ModalShell open={Boolean(active)} onClose={onClose} title={active?.title || 'Info'}>
      <p className="text-sm leading-relaxed text-[#e5e2ec]">{active?.body}</p>
      {type === 'contacts' && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#f0cf65]">
            Official Channels
          </div>
          <div className="flex flex-wrap gap-2">
            {socialPlatforms.map((p) =>
              p.href ? (
                <a
                  key={p.key}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-[40px] items-center rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors ${p.badgeClass}`}
                >
                  {p.name}
                </a>
              ) : (
                <button
                  key={p.key}
                  type="button"
                  onClick={() =>
                    onNotify?.(`${p.name} link not set yet. Admin can add it in Settings.`)
                  }
                  className={`inline-flex min-h-[40px] items-center rounded-lg border px-3.5 py-2 text-xs font-bold opacity-75 transition-opacity hover:opacity-100 ${p.badgeClass}`}
                >
                  {p.name}
                </button>
              )
            )}
            {extraSocials.map((link, idx) => (
              <a
                key={`${link}-${idx}`}
                href={normalizeSocialUrl(link)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center rounded-lg border border-[#d4af37]/50 bg-[#140e22] px-3 py-2 text-xs font-bold text-[#d4af37] hover:text-white"
              >
                Link {idx + 1}
              </a>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
};
