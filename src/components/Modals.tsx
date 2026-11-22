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
} from 'lucide-react';
import { getSocialPlatformItems, normalizeSocialUrl, WHATSAPP_ADMIN_PHONE, WHATSAPP_DISPLAY_PHONE } from '../storage';
import type { AppSettings, CommentItem, InfoModalType, PaymentPlan, PendingPlan, PlayerMedia, SessionUser } from '../types';

export const PESAPAL_WORKER_URL = 'https://vjemma-pesapal.piwantonny.workers.dev';
export const PENDING_PESAPAL_ORDER_KEY = 'vj_emma_pending_pesapal_order';

export interface PendingPesapalOrder {
  orderId?: string;
  name: string;
  phone: string;
  email: string;
  planName: string;
  amount: number;
  days: number;
  method: string;
  createdAt: number;
}

export interface WorkerStatusResponse {
  status?: string;
  payment_status_description?: string;
  payment_status?: string;
  orderId?: string;
  order_tracking_id?: string;
  amount?: number | string;
  name?: string;
  email?: string;
  phone?: string;
  planName?: string;
  days?: number | string;
  confirmation_code?: string;
  message?: string;
  error?: string;
}

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

interface AdminLoginPageProps {
  onSubmit: (email: string, password: string) => void;
  onReturnSite: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onSubmit, onReturnSite }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email.trim(), password);
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
            className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2.5 text-sm font-extrabold text-black transition-transform active:scale-[0.98]"
          >
            Sign In to Admin
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
        Subscribe to watch &amp; download Luo movies, series, and Live TV. Pay securely with Pesapal or Manual WhatsApp ({WHATSAPP_DISPLAY_PHONE}).
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

interface PesapalModalProps {
  open: boolean;
  onClose: () => void;
  plan: PendingPlan | null;
  currentUser: SessionUser | null;
  onManualWhatsappPayment: (phone: string, email: string, method: string, name?: string) => void;
  onNotify: (msg: string) => void;
}

export const PesapalModal: React.FC<PesapalModalProps> = ({
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
  const [method, setMethod] = useState('MTN Mobile Money');
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : ''));
      setPhone(currentUser?.phone || '');
      setEmail(currentUser?.email || '');
      setManualSubmitted(false);
      setIsSubmitting(false);
      setErrorMsg(null);
    }
  }, [open, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanPhone || !cleanEmail) {
      const msg = 'Enter your full name, phone number, and email address.';
      setErrorMsg(msg);
      onNotify(msg);
      return;
    }

    const amount = Number(plan.amount);
    const pendingOrder: PendingPesapalOrder = {
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      planName: plan.planName,
      amount,
      days: Number(plan.days || 1),
      method,
      createdAt: Date.now(),
    };

    try {
      localStorage.setItem(PENDING_PESAPAL_ORDER_KEY, JSON.stringify(pendingOrder));
    } catch {
      // Ignore storage quota issues
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const callbackUrl = `${window.location.origin}/payment-success`;
      const response = await fetch(PESAPAL_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          planName: plan.planName,
          days: Number(plan.days || 1),
          callback_url: callbackUrl,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const redirectUrl = data?.redirect_url || data?.redirectUrl || data?.url;
      const returnedOrderId = data?.orderId || data?.order_tracking_id || data?.orderTrackingId;

      if (returnedOrderId) {
        try {
          localStorage.setItem(
            PENDING_PESAPAL_ORDER_KEY,
            JSON.stringify({ ...pendingOrder, orderId: String(returnedOrderId) })
          );
        } catch {
          // Ignore storage issues
        }
      }

      if (!response.ok || !redirectUrl) {
        const msg =
          data?.error ||
          data?.message ||
          'Could not initiate Pesapal checkout. Try again or pay manually with WhatsApp.';
        setErrorMsg(msg);
        onNotify(msg);
        setIsSubmitting(false);
        return;
      }

      window.location.href = String(redirectUrl);
    } catch {
      const msg = 'Network error connecting to Pesapal. Try again or use Manual WhatsApp below.';
      setErrorMsg(msg);
      onNotify(msg);
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = () => {
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    const cleanName = name.trim();
    onManualWhatsappPayment(cleanPhone, cleanEmail, method, cleanName);
    if (cleanPhone && cleanEmail) {
      setManualSubmitted(true);
    }
  };

  const whatsappMessage = plan
    ? `Hello VJ EMMA - TRUE LIGHT PRODUCTION, I am paying manually for the ${plan.planName} Plan (UGX ${Number(plan.amount).toLocaleString()} / ${plan.days} days). Name: ${name.trim()}, Phone: ${phone.trim()}, Email: ${email.trim()}, Method: ${method}. Please approve my account.`
    : '';
  const whatsappHref = `https://wa.me/${WHATSAPP_ADMIN_PHONE}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <ModalShell open={open} onClose={onClose} title="Pesapal Checkout">
      {plan && (
        <div className="mb-4 rounded-xl border border-[#6a0dad]/45 bg-[#08070d] p-3.5">
          <div className="text-sm font-extrabold text-[#d4af37]">{plan.planName} Plan</div>
          <div className="mt-1 text-xl font-black text-white tabular-nums">
            UGX {Number(plan.amount).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-[#b0aab8]">
            Validity: {plan.days} {plan.days === 1 ? 'Day' : 'Days'} · Pesapal or Manual WhatsApp
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-3 rounded-lg border border-rose-500/60 bg-rose-950/60 px-3 py-2 text-xs font-semibold text-rose-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
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
            Client Phone Number (for Pesapal &amp; WhatsApp confirmation)
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
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">Client Email</label>
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
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">Payment Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full min-h-[44px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2.5 text-sm text-white focus:border-[#d4af37] focus:outline-none"
          >
            <option value="MTN Mobile Money">MTN Mobile Money</option>
            <option value="Airtel Money">Airtel Money</option>
            <option value="Visa / Mastercard">Visa / Mastercard</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-black transition-transform active:scale-[0.98] disabled:opacity-65"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecting to Pesapal...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>PAY / BOOK NOW</span>
            </>
          )}
        </button>
      </form>

      {/* PAY MANUALLY WITH WHATSAPP FALLBACK */}
      <div className="mt-4 rounded-xl border border-[#6a0dad]/60 bg-[#0d0918] p-3.5">
        <div className="text-xs font-extrabold uppercase tracking-wide text-[#f0cf65]">
          Pesapal Failed? Pay Manually with WhatsApp
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[#e0d8ef]">
          Send payment to <span className="font-bold text-white">{WHATSAPP_DISPLAY_PHONE}</span>{' '}
          (VJ EMMA) and submit below for Admin approval.
        </p>

        {!manualSubmitted ? (
          <button
            type="button"
            onClick={handleManualSubmit}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/70 bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white transition-transform active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Pay Manually with WhatsApp</span>
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 p-2.5 text-xs font-semibold text-emerald-200">
              Request saved as Pending Approval. Tap below to send your confirmation on WhatsApp,
              then Admin will approve your access.
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Send WhatsApp Message ({WHATSAPP_DISPLAY_PHONE})</span>
            </a>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

interface PaymentSuccessPageProps {
  onPaymentCompleted: (
    orderId: string,
    workerData: WorkerStatusResponse,
    savedOrder: PendingPesapalOrder | null
  ) => { expiry: number; planName: string; amount: number; name: string; phone: string; email: string };
  onReturnHome: (openPlans?: boolean) => void;
}

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({
  onPaymentCompleted,
  onReturnHome,
}) => {
  const [phase, setPhase] = useState<'loading' | 'completed' | 'failed'>('loading');
  const [orderId, setOrderId] = useState('');
  const [confirmation, setConfirmation] = useState<{
    expiry: number;
    planName: string;
    amount: number;
    name: string;
    phone: string;
    email: string;
  } | null>(null);
  const [errorDetail, setErrorDetail] = useState('');
  const verifiedOnceRef = useRef(false);

  useEffect(() => {
    if (verifiedOnceRef.current) return;
    verifiedOnceRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const savedRaw = localStorage.getItem(PENDING_PESAPAL_ORDER_KEY);
    let savedOrder: PendingPesapalOrder | null = null;
    if (savedRaw) {
      try {
        savedOrder = JSON.parse(savedRaw) as PendingPesapalOrder;
      } catch {
        savedOrder = null;
      }
    }

    const urlOrderId =
      params.get('orderId') ||
      params.get('OrderTrackingId') ||
      params.get('orderTrackingId') ||
      params.get('trackingId') ||
      savedOrder?.orderId ||
      '';

    setOrderId(urlOrderId);

    if (!urlOrderId) {
      setErrorDetail('Missing orderId in URL.');
      setPhase('failed');
      return;
    }

    fetch(`${PESAPAL_WORKER_URL}?orderId=${encodeURIComponent(urlOrderId)}`)
      .then(async (res) => {
        const data: WorkerStatusResponse = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || data?.message || 'Verification failed.');
        }
        const statusStr = String(
          data.status || data.payment_status_description || data.payment_status || ''
        )
          .trim()
          .toUpperCase();

        if (statusStr === 'COMPLETED') {
          const confirmed = onPaymentCompleted(urlOrderId, data, savedOrder);
          setConfirmation(confirmed);
          setPhase('completed');
        } else {
          setErrorDetail(data?.message || (statusStr ? `Payment status: ${statusStr}` : ''));
          setPhase('failed');
        }
      })
      .catch((err) => {
        setErrorDetail(err instanceof Error ? err.message : 'Unable to verify payment.');
        setPhase('failed');
      });
  }, [onPaymentCompleted]);

  const whatsappSupportHref = `https://wa.me/${WHATSAPP_ADMIN_PHONE}?text=${encodeURIComponent(
    `Hello VJ EMMA, my Pesapal Order ID is ${orderId || 'N/A'}. Please assist with my payment confirmation.`
  )}`;

  return (
    <div className="mx-auto max-w-[560px] px-4 py-10">
      <div className="rounded-2xl border-2 border-[#d4af37]/70 bg-[#111018] p-6 shadow-2xl">
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#d4af37]" />
            <h1 className="font-display text-lg font-bold text-[#f0cf65]">
              Verifying Pesapal Payment...
            </h1>
            <p className="text-xs text-white/75">
              Checking payment status for order {orderId || '...'}
            </p>
          </div>
        )}

        {phase === 'completed' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <h1 className="font-display text-xl font-extrabold text-[#f0cf65]">
                Payment Successful - Thank you VJ Emma
              </h1>
              <p className="text-xs text-emerald-300 font-semibold">
                Your subscription is now active for watching &amp; downloading.
              </p>
            </div>

            <div className="rounded-xl border border-[#6a0dad]/60 bg-[#08070d] p-4 space-y-2 text-xs">
              <div className="font-bold uppercase tracking-wider text-[#d4af37]">
                Download / Booking Confirmation
              </div>
              <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                <span className="text-white/70">Order ID</span>
                <span className="font-bold text-white break-all text-right">{orderId}</span>
              </div>
              {confirmation && (
                <>
                  <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                    <span className="text-white/70">Customer</span>
                    <span className="font-bold text-white text-right">{confirmation.name || confirmation.phone}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                    <span className="text-white/70">Phone / Email</span>
                    <span className="font-semibold text-white/90 text-right">
                      {confirmation.phone} {confirmation.email ? `· ${confirmation.email}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                    <span className="text-white/70">Plan</span>
                    <span className="font-bold text-[#f0cf65] text-right">{confirmation.planName}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-white/10 pb-1.5">
                    <span className="text-white/70">Amount Paid</span>
                    <span className="font-black text-white tabular-nums text-right">
                      UGX {Number(confirmation.amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/70">Access Valid Until</span>
                    <span className="font-bold text-emerald-400 text-right">
                      {new Date(confirmation.expiry).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => onReturnHome(false)}
              className="flex min-h-[46px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2.5 text-sm font-extrabold text-black"
            >
              Watch &amp; Download Now
            </button>
          </div>
        )}

        {phase === 'failed' && (
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-12 w-12 text-rose-400" />
              <h1 className="font-display text-xl font-extrabold text-rose-300">
                Payment Failed, Try Again
              </h1>
              {errorDetail && (
                <p className="text-xs text-white/75">{errorDetail}</p>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onReturnHome(true)}
                className="flex min-h-[46px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2.5 text-sm font-extrabold text-black"
              >
                Try Again
              </button>
              <a
                href={whatsappSupportHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/70 bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Need Help? Pay Manually on WhatsApp ({WHATSAPP_DISPLAY_PHONE})</span>
              </a>
              <button
                type="button"
                onClick={() => onReturnHome(false)}
                className="min-h-[40px] rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white/80"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PlayerModalProps {
  media: PlayerMedia | null;
  canDownload?: boolean;
  onClose: () => void;
  onNotify: (msg: string) => void;
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
  return /\.(mp4|webm|ogg|mov|m3u8)(\?|#|$)/i.test(url);
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  media,
  canDownload = false,
  onClose,
  onNotify,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const ytEmbed = media ? getYouTubeEmbedUrl(media.videoUrl) : null;
  const useIframe = Boolean(media && (ytEmbed || (media.isLive && !isDirectVideoFile(media.videoUrl))));
  const iframeSrc = ytEmbed || media?.videoUrl || '';

  useEffect(() => {
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
      onNotify('Active subscription is required to download movies.');
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
            Subscription Payment Required
          </div>
          <p className="text-xs leading-relaxed text-white/80">
            Watching and downloading are locked until your payment is completed.
          </p>
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
            controlsList={!canDownload ? 'nodownload' : undefined}
            playsInline
            onContextMenu={(e) => {
              if (!canDownload) e.preventDefault();
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className={enlarged ? 'h-full max-h-[calc(100vh-68px)] w-full bg-black' : 'block max-h-[56vh] w-full bg-black'}
          />
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
          {!media.isLive && canDownload && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-bold text-white whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
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
      body: 'We value your privacy. Your phone number and email are used strictly for account access, Pesapal payment verification, and automated WhatsApp subscription receipts.',
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
