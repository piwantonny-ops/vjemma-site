import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Download, Maximize2, Minimize2, MessageCircle, MessageSquare, ShieldCheck } from 'lucide-react';
import { getSocialPlatformItems, normalizeSocialUrl, WHATSAPP_ADMIN_PHONE, WHATSAPP_DISPLAY_PHONE } from '../storage';
import type { AppSettings, CommentItem, InfoModalType, PendingPlan, PlayerMedia, SessionUser } from '../types';

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

interface PesapalModalProps {
  open: boolean;
  onClose: () => void;
  plan: PendingPlan | null;
  currentUser: SessionUser | null;
  onCompletePayment: (phone: string, email: string, method: string) => void;
  onManualWhatsappPayment: (phone: string, email: string, method: string) => void;
}

export const PesapalModal: React.FC<PesapalModalProps> = ({
  open,
  onClose,
  plan,
  currentUser,
  onCompletePayment,
  onManualWhatsappPayment,
}) => {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState('MTN Mobile Money');
  const [manualSubmitted, setManualSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone(currentUser?.phone || '');
      setEmail(currentUser?.email || '');
      setManualSubmitted(false);
    }
  }, [open, currentUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCompletePayment(phone.trim(), email.trim(), method);
  };

  const handleManualSubmit = () => {
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    onManualWhatsappPayment(cleanPhone, cleanEmail, method);
    if (cleanPhone && cleanEmail) {
      setManualSubmitted(true);
    }
  };

  const whatsappMessage = plan
    ? `Hello VJ EMMA - TRUE LIGHT PRODUCTION, I am paying manually for the ${plan.planName} Plan (UGX ${Number(plan.amount).toLocaleString()} / ${plan.days} days). Phone: ${phone.trim()}, Email: ${email.trim()}, Method: ${method}. Please approve my account.`
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
            Validity: {plan.days} Days · Pesapal or Manual WhatsApp
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-[#f0cf65]">
            Client Phone Number (for Pesapal & WhatsApp confirmation)
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
          className="mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2.5 text-sm font-extrabold text-black transition-transform active:scale-[0.98]"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Complete Pesapal Payment</span>
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
