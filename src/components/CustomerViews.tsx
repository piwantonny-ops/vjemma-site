import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Film, Heart, Info, Lock, MessageCircle, Play, Radio, RefreshCw, Share2 } from 'lucide-react';
import { getSocialPlatformItems, isVipLabel, normalizeSocialUrl, parseGenreLine, parseMovieGenres, useResolvedMedia } from '../storage';
import { PWAInstallButton } from './PWAInstallButton';
import type {
  AppSettings,
  AppState,
  Banner,
  Episode,
  InfoModalType,
  LiveTvChannel,
  Movie,
  Season,
} from '../types';

/* --------------------------------------------------------------------------
   BANNER CAROUSEL - SMOOTH SLIDE/FADE FLIP EVERY 5 SECONDS + BANNER TEXT
-------------------------------------------------------------------------- */
const BannerSlideImage: React.FC<{ imageRef: string }> = ({ imageRef }) => {
  const src = useResolvedMedia(imageRef);
  if (!src) {
    return (
      <div className="h-full w-full bg-[radial-gradient(circle_at_center,rgba(106,13,173,0.42)_0%,#050507_78%)]" />
    );
  }
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className="block h-full w-full object-cover"
    />
  );
};

const BannerCarousel: React.FC<{
  banners: Banner[];
  onBannerAction?: () => void;
}> = ({ banners, onBannerAction }) => {
  const activeBanners = banners.slice(0, 5);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (currentIdx >= activeBanners.length) {
      setCurrentIdx(0);
    }
  }, [activeBanners.length, currentIdx]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % activeBanners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeBanners.length]);

  const move = (dir: number) => {
    if (activeBanners.length <= 1) return;
    setCurrentIdx((prev) => (prev + dir + activeBanners.length) % activeBanners.length);
  };

  return (
    <div className="relative aspect-[16/9] max-h-[420px] w-full overflow-hidden border-b-2 border-[#6a0dad]/70 bg-[#0d0a14]">
      {activeBanners.length === 0 ? (
        <div className="h-full w-full bg-[radial-gradient(circle_at_center,rgba(106,13,173,0.38)_0%,#050507_78%)]" />
      ) : (
        <>
          <div className="relative h-full w-full">
            {activeBanners.map((b, idx) => {
              const isActive = idx === currentIdx;
              const isPrev =
                idx === (currentIdx - 1 + activeBanners.length) % activeBanners.length;
              const hasCopy = Boolean(
                b.title?.trim() || b.subText?.trim() || b.buttonText?.trim()
              );
              return (
                <div
                  key={b.id}
                  aria-hidden={!isActive}
                  className={`absolute inset-0 h-full w-full bg-[#0a0810] transition-all duration-700 ease-in-out ${
                    isActive
                      ? 'z-10 translate-x-0 scale-100 opacity-100'
                      : isPrev
                        ? 'pointer-events-none z-0 -translate-x-8 scale-[1.01] opacity-0'
                        : 'pointer-events-none z-0 translate-x-8 scale-[1.01] opacity-0'
                  }`}
                >
                  <BannerSlideImage imageRef={b.image} />

                  {hasCopy && (
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 sm:p-6">
                      <div className="max-w-xl">
                        {b.title?.trim() && (
                          <h2 className="font-display text-base font-extrabold leading-tight text-white drop-shadow sm:text-2xl">
                            {b.title.trim()}
                          </h2>
                        )}
                        {b.subText?.trim() && (
                          <p className="mt-1 text-xs font-medium text-[#e6dcf5] line-clamp-2 sm:text-sm">
                            {b.subText.trim()}
                          </p>
                        )}
                        {b.buttonText?.trim() && (
                          <button
                            type="button"
                            onClick={onBannerAction}
                            className="mt-2.5 inline-flex min-h-[38px] items-center rounded-lg bg-gradient-to-r from-[#d4af37] via-[#f0cf65] to-[#d4af37] px-4 py-1.5 text-xs font-extrabold text-black shadow transition-transform active:scale-95"
                          >
                            {b.buttonText.trim()}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {activeBanners.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Previous banner"
                className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#d4af37] bg-[#4a077a]/80 text-[#d4af37] hover:bg-[#6a0dad] transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Next banner"
                className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#d4af37] bg-[#4a077a]/80 text-[#d4af37] hover:bg-[#6a0dad] transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2">
                {activeBanners.map((b, idx) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    aria-label={`Slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentIdx ? 'w-6 bg-[#d4af37]' : 'w-2 bg-white/55'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

/* --------------------------------------------------------------------------
   SHARED POSTER ACTION BAR (LIKE / SHARE / COMMENT)
-------------------------------------------------------------------------- */
const PosterSocialBar: React.FC<{
  itemId: string;
  title: string;
  likeCount: number;
  isLiked: boolean;
  commentsCount: number;
  onLike: (id: string) => void;
  onShare: (id: string) => void;
  onOpenComments: (id: string) => void;
  overlay?: boolean;
}> = ({
  itemId,
  title,
  likeCount,
  isLiked,
  commentsCount,
  onLike,
  onShare,
  onOpenComments,
  overlay = true,
}) => {
  const buttonsRow = (
    <div className="grid grid-cols-3 divide-x divide-white/15 border-t border-[#6a0dad]/60 bg-[#0b0714]/90 backdrop-blur-xs">
      <button
        type="button"
        onClick={() => onLike(itemId)}
        aria-label={`Like ${title}`}
        className={`flex min-h-[40px] items-center justify-center gap-1 px-1 text-[11px] font-bold transition-colors ${
          isLiked ? 'text-[#d4af37]' : 'text-white hover:text-[#d4af37]'
        }`}
      >
        <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-[#d4af37] text-[#d4af37]' : ''}`} />
        <span className="tabular-nums">{likeCount}</span>
      </button>
      <button
        type="button"
        onClick={() => onShare(itemId)}
        aria-label={`Share ${title}`}
        className="flex min-h-[40px] items-center justify-center gap-1 px-1 text-[11px] font-bold text-white hover:text-[#d4af37] transition-colors"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span>Share</span>
      </button>
      <button
        type="button"
        onClick={() => onOpenComments(itemId)}
        aria-label={`Comments for ${title}`}
        className="flex min-h-[40px] items-center justify-center gap-1 px-1 text-[11px] font-bold text-white hover:text-[#d4af37] transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span className="tabular-nums">{commentsCount}</span>
      </button>
    </div>
  );

  if (!overlay) return buttonsRow;

  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent pt-6">
      {buttonsRow}
    </div>
  );
};

/* --------------------------------------------------------------------------
   MOVIE CARD - BOSSFLIX LOOK WITH LIKE / SHARE / COMMENT ON SAME POSTER
-------------------------------------------------------------------------- */
interface MovieCardProps {
  movie: Movie;
  settings: AppSettings;
  likeCount: number;
  isLiked: boolean;
  commentsCount: number;
  isAdmin: boolean;
  isSubscribed: boolean;
  onWatch: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onLike: (id: string) => void;
  onShare: (id: string) => void;
  onOpenComments: (id: string) => void;
  onAdminEdit?: (id: string) => void;
  onAdminDelete?: (id: string) => void;
}

const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  settings,
  likeCount,
  isLiked,
  commentsCount,
  isAdmin,
  isSubscribed,
  onWatch,
  onOpenDetails,
  onLike,
  onShare,
  onOpenComments,
  onAdminEdit,
  onAdminDelete,
}) => {
  const posterSrc = useResolvedMedia(movie.poster);

  const showLabel = settings.showPosterLabel !== false;
  const showRating = settings.showPosterRating !== false;
  const showSocial = settings.showPosterSocialBar !== false;
  const showYear = settings.showPosterYear !== false;
  const showActors = settings.showPosterActors !== false;
  const showDescription = settings.showPosterDescription !== false;

  const tagsList = (movie.label || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const isVipMovie = isVipLabel(movie.label);
  const isVipLocked = isVipMovie && !isSubscribed && !isAdmin;
  const movieGenres = parseMovieGenres(movie.genre, movie.category);
  const yearAndDuration = [showYear ? movie.year : '', movie.duration].filter(Boolean).join(' · ');

  const handlePosterTap = () => {
    if (isVipLocked) {
      onWatch(movie.id);
      return;
    }
    if (onOpenDetails) {
      onOpenDetails(movie.id);
    } else {
      onWatch(movie.id);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[#6a0dad]/60 bg-[#110e1a] shadow-lg transition-colors hover:border-[#d4af37]">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#181228]">
        <button
          type="button"
          onClick={handlePosterTap}
          aria-label={`Open ${movie.title}`}
          className="block h-full w-full text-left"
        >
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={movie.title}
              referrerPolicy="no-referrer"
              className="block h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#2b0c4e] via-[#150b24] to-[#08060c] p-4 text-center">
              <Film className="h-9 w-9 text-[#d4af37]" />
              <span className="font-display text-xs font-bold text-white line-clamp-2">{movie.title}</span>
            </div>
          )}
        </button>

        {/* Top Scrim + Optional Poster Label / GOLD VIP Badge & Rating */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />
        {(isVipMovie || (showLabel && tagsList.length > 0)) && (
          <div className="pointer-events-none absolute left-2 top-2 flex max-w-[72%] flex-wrap gap-1">
            {tagsList.slice(0, 3).map((tag) => {
              const isVipTag = tag.toUpperCase().includes('VIP');
              return (
                <span
                  key={tag}
                  className={
                    isVipTag
                      ? 'inline-flex items-center gap-0.5 rounded border border-[#f0cf65] bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow'
                      : 'rounded border border-[#d4af37] bg-[#6a0dad]/95 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#f0cf65] shadow'
                  }
                >
                  {isVipTag && isVipLocked && <Lock className="h-2.5 w-2.5" />}
                  <span>{tag}</span>
                </span>
              );
            })}
          </div>
        )}
        {showRating && movie.rating && (
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/85 border border-[#d4af37]/50 px-1.5 py-0.5 text-[11px] font-extrabold text-[#d4af37] tabular-nums">
            ★ {movie.rating}
          </span>
        )}

        {/* Bottom Scrim + Like / Share / Comment ON THE SAME POSTER */}
        {showSocial && (
          <PosterSocialBar
            itemId={movie.id}
            title={movie.title}
            likeCount={likeCount}
            isLiked={isLiked}
            commentsCount={commentsCount}
            onLike={onLike}
            onShare={onShare}
            onOpenComments={onOpenComments}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <button
          type="button"
          onClick={() => (onOpenDetails ? onOpenDetails(movie.id) : onWatch(movie.id))}
          className="text-left"
        >
          <h3 className="font-display text-sm font-semibold leading-snug text-white line-clamp-2 hover:text-[#f0cf65] transition-colors">
            {movie.title}
          </h3>
        </button>

        {yearAndDuration && (
          <div className="text-[11px] font-medium text-[#f0cf65] tabular-nums">
            {yearAndDuration}
          </div>
        )}

        {movieGenres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {movieGenres.map((g) => (
              <span
                key={g}
                className="rounded border border-[#6a0dad]/60 bg-[#1a112a] px-1.5 py-0.5 text-[10px] font-semibold text-[#e6dcf5]"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {showActors && movie.actors && (
          <p className="text-[11px] font-normal text-[#e0d8ef] line-clamp-1">
            <span className="font-semibold text-white/90">Actors:</span> {movie.actors}
          </p>
        )}

        {showDescription && movie.description && (
          <p className="text-[11px] leading-snug text-[#b0aab8] line-clamp-2">
            {movie.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => onWatch(movie.id)}
            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#f0cf65] to-[#d4af37] px-2.5 py-2 text-xs font-bold tracking-normal text-black shadow transition-transform active:scale-[0.98]"
          >
            {isVipLocked ? (
              <>
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">VIP · Pay to Watch</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
                <span>Watch</span>
              </>
            )}
          </button>
          {onOpenDetails && (
            <button
              type="button"
              onClick={() => onOpenDetails(movie.id)}
              aria-label={`Details for ${movie.title}`}
              className="flex min-h-[42px] shrink-0 items-center justify-center rounded-lg border border-[#6a0dad] bg-[#171126] px-2.5 py-2 text-[11px] font-bold text-[#f0cf65] hover:border-[#d4af37]"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onAdminEdit?.(movie.id)}
              className="min-h-[38px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-2 py-1 text-[11px] font-bold text-[#f0cf65]"
            >
              Edit Poster
            </button>
            <button
              type="button"
              onClick={() => onAdminDelete?.(movie.id)}
              className="min-h-[38px] rounded-md bg-[#b71c1c] px-2 py-1 text-[11px] font-bold text-white"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

interface MoviesGridProps {
  movies: Movie[];
  emptyText: string;
  state: AppState;
  isSubscribed?: boolean;
  onWatch: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onLike: (id: string) => void;
  onShare: (id: string) => void;
  onOpenComments: (id: string) => void;
  onAdminEdit?: (id: string) => void;
  onAdminDelete?: (id: string) => void;
}

const MoviesGrid: React.FC<MoviesGridProps> = ({
  movies,
  emptyText,
  state,
  isSubscribed = false,
  onWatch,
  onOpenDetails,
  onLike,
  onShare,
  onOpenComments,
  onAdminEdit,
  onAdminDelete,
}) => {
  if (movies.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-dashed border-[#6a0dad] bg-[#110e1a] px-4 py-8 text-center text-sm font-medium text-white/80">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {movies.map((m) => {
        const likeInfo = state.likes[m.id] || { count: 0, liked: false };
        const commentsCount = (state.comments[m.id] || []).length;
        return (
          <MovieCard
            key={m.id}
            movie={m}
            settings={state.settings}
            likeCount={likeInfo.count}
            isLiked={likeInfo.liked}
            commentsCount={commentsCount}
            isAdmin={state.isAdminLoggedIn}
            isSubscribed={isSubscribed}
            onWatch={onWatch}
            onOpenDetails={onOpenDetails}
            onLike={onLike}
            onShare={onShare}
            onOpenComments={onOpenComments}
            onAdminEdit={onAdminEdit}
            onAdminDelete={onAdminDelete}
          />
        );
      })}
    </div>
  );
};

/* --------------------------------------------------------------------------
   FOOTER (SHARED ACROSS HOME, MOVIES, SERIES, LIVE TV)
-------------------------------------------------------------------------- */
export const SocialPlatformsRow: React.FC<{
  settings?: Partial<AppSettings>;
  onNotify?: (msg: string) => void;
  centered?: boolean;
}> = ({ settings, onNotify, centered = false }) => {
  const platformLinks = getSocialPlatformItems(settings);
  const extraSocials = (settings?.socialLinks || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className={`flex flex-wrap gap-2 ${centered ? 'justify-center' : ''}`}>
      {platformLinks.map((p) =>
        p.href ? (
          <a
            key={p.key}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-bold transition-colors ${p.badgeClass}`}
          >
            <span>{p.name}</span>
          </a>
        ) : (
          <button
            key={p.key}
            type="button"
            onClick={() =>
              onNotify?.(`${p.name} link not set yet. Admin can add it in Settings.`)
            }
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-bold opacity-75 transition-opacity hover:opacity-100 ${p.badgeClass}`}
          >
            <span>{p.name}</span>
          </button>
        )
      )}
      {extraSocials.map((link, idx) => (
        <a
          key={`${link}-${idx}`}
          href={normalizeSocialUrl(link)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[38px] items-center rounded-lg border border-[#d4af37]/50 bg-[#140e22] px-3 py-1.5 text-xs font-bold text-[#d4af37] hover:text-white"
        >
          Link {idx + 1}
        </a>
      ))}
    </div>
  );
};

const SiteFooter: React.FC<{
  settings: AppSettings;
  onOpenInfo: (type: InfoModalType) => void;
  onNotify?: (msg: string) => void;
}> = ({ settings, onOpenInfo, onNotify }) => {
  return (
    <footer className="mt-6 border-t-2 border-[#6a0dad]/70 bg-[#0a0712] px-4 py-7 text-center">
      <div className="mb-4 flex flex-wrap justify-center gap-4">
        {(
          [
            ['about', 'About Us'],
            ['contacts', 'Contacts'],
            ['terms', 'Terms'],
            ['privacy', 'Privacy'],
          ] as [InfoModalType, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onOpenInfo(key)}
            className="min-h-[40px] px-2 text-xs font-bold text-[#d4af37] hover:text-white transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-white">
        Our Services
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#e6dcf5]">
        <span>Photography</span>
        <span aria-hidden="true" className="text-[#d4af37]">·</span>
        <span>Videography</span>
        <span aria-hidden="true" className="text-[#d4af37]">·</span>
        <span>Documentary</span>
        <span aria-hidden="true" className="text-[#d4af37]">·</span>
        <span>Secretary</span>
        <span aria-hidden="true" className="text-[#d4af37]">·</span>
        <span>Computer Training</span>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[#f0cf65]">
          Follow &amp; Contact Us
        </div>
        <SocialPlatformsRow settings={settings} onNotify={onNotify} centered />
      </div>

      <div className="mb-4 flex justify-center">
        <PWAInstallButton variant="compact" />
      </div>

      <div className="border-t border-white/15 pt-3 text-xs font-medium text-white/80">
        Copyright 2026 VJ EMMA - TRUE LIGHT PRODUCTION.
      </div>
    </footer>
  );
};

/* --------------------------------------------------------------------------
   1. HOME VIEW
-------------------------------------------------------------------------- */
interface HomeViewProps {
  state: AppState;
  isSubscribed?: boolean;
  isCatalogLoading?: boolean;
  onWatchMovie: (id: string) => void;
  onOpenMovieDetails?: (id: string) => void;
  onOpenSeasonDetails?: (id: string) => void;
  onTapLockedVipSeason?: (season: Season) => void;
  onLikeMovie: (id: string) => void;
  onShareMovie: (id: string) => void;
  onOpenComments: (id: string) => void;
  onOpenInfo: (type: InfoModalType) => void;
  onBannerAction?: () => void;
  onNotify?: (msg: string) => void;
  onAdminEditMovie?: (id: string) => void;
  onAdminDeleteMovie?: (id: string) => void;
  onRefresh?: () => Promise<void>;
}

export const HomeView: React.FC<HomeViewProps> = ({
  state,
  isSubscribed = false,
  isCatalogLoading = false,
  onWatchMovie,
  onOpenMovieDetails,
  onOpenSeasonDetails,
  onTapLockedVipSeason,
  onLikeMovie,
  onShareMovie,
  onOpenComments,
  onOpenInfo,
  onBannerAction,
  onNotify,
  onAdminEditMovie,
  onAdminDeleteMovie,
  onRefresh,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  const PULL_THRESHOLD = 64;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!onRefresh || isRefreshing) return;
    if (window.scrollY > 2) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    isPullingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPullingRef.current || touchStartYRef.current === null || touchStartXRef.current === null) {
      return;
    }
    if (window.scrollY > 2) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - touchStartYRef.current;
    const deltaX = Math.abs(touch.clientX - touchStartXRef.current);
    if (deltaY <= 0 || deltaX > deltaY) {
      if (pullDistance !== 0) setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(104, Math.round(deltaY * 0.55)));
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    touchStartYRef.current = null;
    touchStartXRef.current = null;

    if (pullDistance >= PULL_THRESHOLD && onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(52);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const trendingMovies = [...state.movies].reverse();
  const homeSeasons = [...state.seasons].reverse();
  const christianMovies = state.movies
    .filter(
      (m) =>
        (m.category || '').toLowerCase().includes('christian') ||
        (m.category || '').toLowerCase().includes('gospel') ||
        (m.genre || '').toLowerCase().includes('christian') ||
        (m.genre || '').toLowerCase().includes('faith')
    )
    .reverse();

  const showSocial = state.settings.showPosterSocialBar !== false;
  const showYear = state.settings.showPosterYear !== false;
  const showActors = state.settings.showPosterActors !== false;
  const showDescription = state.settings.showPosterDescription !== false;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {(pullDistance > 8 || isRefreshing) && (
        <div
          style={{ height: `${Math.max(42, pullDistance)}px` }}
          className="flex items-center justify-center gap-2 overflow-hidden border-b border-[#d4af37]/30 bg-[#140a24] text-xs font-bold text-[#f0cf65] transition-all duration-150"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>
            {isRefreshing
              ? 'Refreshing latest movies & series...'
              : pullDistance >= PULL_THRESHOLD
                ? 'Release to refresh'
                : 'Pull down to refresh'}
          </span>
        </div>
      )}

      <BannerCarousel banners={state.banners} onBannerAction={onBannerAction} />

      <div className="border-b border-[#d4af37]/40 bg-gradient-to-r from-[#4a077a] via-[#6a0dad] to-[#4a077a] px-4 py-4 text-center">
        <p className="font-display text-sm font-bold tracking-wide text-[#f0cf65] text-balance sm:text-base">
          VJ EMMA TRUE LIGHT PRODUCTION · THE PRIDE OF LUO PEOPLE
        </p>
      </div>

      <div className="px-4 py-5">
        <div className="mb-3 flex items-center justify-between border-b border-[#6a0dad]/50 pb-2">
          <h2 className="font-display text-lg font-semibold tracking-tight text-white">
            Trending Now
          </h2>
        </div>
        <MoviesGrid
          movies={trendingMovies}
          emptyText={
            isCatalogLoading
              ? 'Loading movies & series from Cloud Database...'
              : 'No movies available yet. Please check back soon.'
          }
          state={state}
          isSubscribed={isSubscribed}
          onWatch={onWatchMovie}
          onOpenDetails={onOpenMovieDetails}
          onLike={onLikeMovie}
          onShare={onShareMovie}
          onOpenComments={onOpenComments}
          onAdminEdit={onAdminEditMovie}
          onAdminDelete={onAdminDeleteMovie}
        />

        {homeSeasons.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between border-b border-[#6a0dad]/50 pb-2">
              <h2 className="font-display text-lg font-semibold tracking-tight text-white">
                Series &amp; Seasons
              </h2>
            </div>
            <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {homeSeasons.map((s) => {
                const seasonEpisodes = state.episodes.filter((ep) => ep.seasonId === s.id);
                const likeInfo = state.likes[s.id] || { count: 0, liked: false };
                const commentsCount = (state.comments[s.id] || []).length;
                const isVipSeason = isVipLabel(s.label);
                const isVipLocked = isVipSeason && !isSubscribed && !state.isAdminLoggedIn;
                const seasonGenres = parseMovieGenres(s.genre);
                const yearAndDuration = [showYear ? s.year : '', s.duration].filter(Boolean).join(' · ');

                const handleOpenSeason = () => {
                  if (isVipLocked && onTapLockedVipSeason) {
                    onTapLockedVipSeason(s);
                    return;
                  }
                  onOpenSeasonDetails?.(s.id);
                };

                return (
                  <article
                    key={`home-sea-${s.id}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-[#6a0dad]/60 bg-[#110e1a] shadow-lg transition-colors hover:border-[#d4af37]"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#181228]">
                      <button
                        type="button"
                        onClick={handleOpenSeason}
                        aria-label={`Open ${s.seriesTitle}`}
                        className="block h-full w-full text-left"
                      >
                        <SeasonPoster posterRef={s.poster} title={s.seriesTitle} />
                      </button>
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />
                      {(s.label || '').trim() && (
                        <div className="pointer-events-none absolute left-2 top-2 flex max-w-[72%] flex-wrap gap-1">
                          <span
                            className={
                              isVipSeason
                                ? 'inline-flex items-center gap-0.5 rounded border border-[#f0cf65] bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow'
                                : 'rounded border border-[#d4af37] bg-[#6a0dad]/95 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#f0cf65] shadow'
                            }
                          >
                            {isVipSeason && isVipLocked && <Lock className="h-2.5 w-2.5" />}
                            <span>{(s.label || '').trim()}</span>
                          </span>
                        </div>
                      )}
                      {showSocial && (
                        <PosterSocialBar
                          itemId={s.id}
                          title={`${s.seriesTitle} - Season ${s.seasonNumber}`}
                          likeCount={likeInfo.count}
                          isLiked={likeInfo.liked}
                          commentsCount={commentsCount}
                          onLike={onLikeMovie}
                          onShare={onShareMovie}
                          onOpenComments={onOpenComments}
                        />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-1.5 p-3">
                      <button type="button" onClick={handleOpenSeason} className="text-left">
                        <h3 className="font-display text-sm font-semibold leading-snug text-white line-clamp-2 hover:text-[#f0cf65] transition-colors">
                          {s.seriesTitle}
                        </h3>
                      </button>

                      <div className="text-[11px] font-medium text-[#f0cf65] tabular-nums">
                        Season {s.seasonNumber} · {seasonEpisodes.length}{' '}
                        {seasonEpisodes.length === 1 ? 'Ep' : 'Eps'}
                        {yearAndDuration ? ` · ${yearAndDuration}` : ''}
                      </div>

                      {seasonGenres.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {seasonGenres.map((g) => (
                            <span
                              key={g}
                              className="rounded border border-[#6a0dad]/60 bg-[#1a112a] px-1.5 py-0.5 text-[10px] font-semibold text-[#e6dcf5]"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}

                      {showActors && s.actors && (
                        <p className="text-[11px] font-normal text-[#e0d8ef] line-clamp-1">
                          <span className="font-semibold text-white/90">Actors:</span> {s.actors}
                        </p>
                      )}

                      {showDescription && s.description && (
                        <p className="text-[11px] leading-snug text-[#b0aab8] line-clamp-2">
                          {s.description}
                        </p>
                      )}

                      <div className="mt-auto flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={handleOpenSeason}
                          className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#f0cf65] to-[#d4af37] px-2.5 py-2 text-xs font-bold tracking-normal text-black shadow transition-transform active:scale-[0.98]"
                        >
                          {isVipLocked ? (
                            <>
                              <Lock className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">VIP · Pay to Watch</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
                              <span>Watch Series</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="mb-3 flex items-center justify-between border-b border-[#6a0dad]/50 pb-2">
          <h2 className="font-display text-lg font-semibold tracking-tight text-white">
            Christian Movies
          </h2>
        </div>
        <MoviesGrid
          movies={christianMovies}
          emptyText={
            isCatalogLoading
              ? 'Loading movies from Cloud Database...'
              : 'No Christian movies available yet.'
          }
          state={state}
          isSubscribed={isSubscribed}
          onWatch={onWatchMovie}
          onOpenDetails={onOpenMovieDetails}
          onLike={onLikeMovie}
          onShare={onShareMovie}
          onOpenComments={onOpenComments}
          onAdminEdit={onAdminEditMovie}
          onAdminDelete={onAdminDeleteMovie}
        />
      </div>

      <SiteFooter
        settings={state.settings}
        onOpenInfo={onOpenInfo}
        onNotify={onNotify}
      />
    </div>
  );
};

/* --------------------------------------------------------------------------
   2. MOVIES VIEW (ONE SINGLE HORIZONTAL LINE GENRE / CATEGORY BAR)
-------------------------------------------------------------------------- */
interface MoviesViewProps {
  state: AppState;
  isSubscribed?: boolean;
  onWatchMovie: (id: string) => void;
  onOpenMovieDetails?: (id: string) => void;
  onLikeMovie: (id: string) => void;
  onShareMovie: (id: string) => void;
  onOpenComments: (id: string) => void;
  onOpenInfo: (type: InfoModalType) => void;
  onNotify?: (msg: string) => void;
  onAdminEditMovie?: (id: string) => void;
  onAdminDeleteMovie?: (id: string) => void;
}

export const MoviesView: React.FC<MoviesViewProps> = ({
  state,
  isSubscribed = false,
  onWatchMovie,
  onOpenMovieDetails,
  onLikeMovie,
  onShareMovie,
  onOpenComments,
  onOpenInfo,
  onNotify,
  onAdminEditMovie,
  onAdminDeleteMovie,
}) => {
  const [selectedGenre, setSelectedGenre] = useState('ALL');

  const parsedGenres = parseGenreLine(state.settings.genreLine);
  const genreOptions = ['ALL', ...parsedGenres];

  const filteredMovies = [...state.movies].reverse().filter((m) => {
    if (selectedGenre === 'ALL') return true;
    const sel = selectedGenre.toLowerCase();
    const movieGenres = parseMovieGenres(m.genre, m.category).map((g) => g.toLowerCase());

    if (movieGenres.includes(sel)) return true;
    if (
      sel === 'christian' &&
      movieGenres.some((g) => g.includes('christian') || g.includes('faith') || g.includes('gospel'))
    ) {
      return true;
    }
    if (sel === 'vip movies' && isVipLabel(m.label)) {
      return true;
    }
    return false;
  });

  return (
    <div>
      <div className="px-4 py-5">
        <div className="mb-3 border-b border-[#6a0dad]/50 pb-2">
          <h2 className="font-display text-lg font-semibold text-white">All Movies</h2>
        </div>

        {/* ONE SINGLE HORIZONTAL LINE OF GENRES / CATEGORIES */}
        <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-1">
          {genreOptions.map((gen) => (
            <button
              key={`gen-${gen}`}
              type="button"
              onClick={() => setSelectedGenre(gen)}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedGenre === gen
                  ? 'border-[#d4af37] bg-[#d4af37] text-black'
                  : 'border-[#6a0dad] bg-[#140e22] text-white hover:bg-[#6a0dad]/40'
              }`}
            >
              {gen === 'ALL' ? 'All' : gen}
            </button>
          ))}
        </div>

        <MoviesGrid
          movies={filteredMovies}
          emptyText="No movies found for the selected genre."
          state={state}
          isSubscribed={isSubscribed}
          onWatch={onWatchMovie}
          onOpenDetails={onOpenMovieDetails}
          onLike={onLikeMovie}
          onShare={onShareMovie}
          onOpenComments={onOpenComments}
          onAdminEdit={onAdminEditMovie}
          onAdminDelete={onAdminDeleteMovie}
        />
      </div>

      <SiteFooter
        settings={state.settings}
        onOpenInfo={onOpenInfo}
        onNotify={onNotify}
      />
    </div>
  );
};

/* --------------------------------------------------------------------------
   3. SERIES VIEW (EVERY SEASON POSTER HAS LIKE / SHARE / COMMENT)
-------------------------------------------------------------------------- */
const SeasonPoster: React.FC<{ posterRef: string; title: string }> = ({ posterRef, title }) => {
  const src = useResolvedMedia(posterRef);
  if (!src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-[#2b0c4e] via-[#150b24] to-[#08060c] p-3 text-center">
        <Film className="h-7 w-7 text-[#d4af37]" />
        <span className="font-display text-[11px] font-bold text-white line-clamp-2">{title}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={title}
      referrerPolicy="no-referrer"
      className="block h-full w-full object-cover"
    />
  );
};

interface SeriesViewProps {
  state: AppState;
  seasons: Season[];
  episodes: Episode[];
  socialLinksRaw: string;
  isSubscribed?: boolean;
  onWatchEpisode: (id: string) => void;
  onDownloadEpisode?: (id: string) => void;
  onOpenSeasonDetails?: (id: string) => void;
  onTapLockedVipSeason?: (season: Season) => void;
  onLike: (id: string) => void;
  onShare: (id: string) => void;
  onOpenComments: (id: string) => void;
  onOpenInfo: (type: InfoModalType) => void;
  onNotify?: (msg: string) => void;
}

export const SeriesView: React.FC<SeriesViewProps> = ({
  state,
  seasons,
  episodes,
  socialLinksRaw: _socialLinksRaw,
  isSubscribed = false,
  onWatchEpisode,
  onDownloadEpisode,
  onOpenSeasonDetails,
  onTapLockedVipSeason,
  onLike,
  onShare,
  onOpenComments,
  onOpenInfo,
  onNotify,
}) => {
  const showSocial = state.settings.showPosterSocialBar !== false;

  return (
    <div>
      <div className="px-4 py-5">
        <div className="mb-4 border-b border-[#6a0dad]/50 pb-2">
          <h2 className="font-display text-lg font-semibold text-white">Series & Seasons</h2>
        </div>

        {seasons.length === 0 ? (
          <div className="mb-6 rounded-xl border border-dashed border-[#6a0dad] bg-[#110e1a] px-4 py-8 text-center text-sm font-medium text-white/80">
            No series available yet. Please check back soon.
          </div>
        ) : (
          <div className="space-y-4">
            {seasons.map((s) => {
              const seasonEpisodes = episodes
                .filter((ep) => ep.seasonId === s.id)
                .sort((a, b) => Number(a.episodeNumber) - Number(b.episodeNumber));
              const likeInfo = state.likes[s.id] || { count: 0, liked: false };
              const commentsCount = (state.comments[s.id] || []).length;
              const seasonTitle = `${s.seriesTitle} - Season ${s.seasonNumber}`;
              const isVipSeason = isVipLabel(s.label);
              const isVipLocked = isVipSeason && !isSubscribed && !state.isAdminLoggedIn;

              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-[#6a0dad]/70 bg-[#110e1a] p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="relative aspect-[2/3] w-44 shrink-0 self-center overflow-hidden rounded-xl border border-[#d4af37]/60 bg-[#181228] sm:w-44 sm:self-start">
                      <button
                        type="button"
                        onClick={() => {
                          if (isVipLocked && onTapLockedVipSeason) {
                            onTapLockedVipSeason(s);
                          } else {
                            onOpenSeasonDetails?.(s.id);
                          }
                        }}
                        aria-label={`Open ${seasonTitle}`}
                        className="block h-full w-full"
                      >
                        <SeasonPoster posterRef={s.poster} title={s.seriesTitle} />
                      </button>
                      {(s.label || '').trim() && (
                        <span
                          className={
                            isVipSeason
                              ? 'pointer-events-none absolute left-2 top-2 inline-flex items-center gap-0.5 rounded border border-[#f0cf65] bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow'
                              : 'pointer-events-none absolute left-2 top-2 rounded border border-[#d4af37] bg-[#6a0dad]/95 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#f0cf65] shadow'
                          }
                        >
                          {isVipSeason && isVipLocked && <Lock className="h-2.5 w-2.5" />}
                          <span>{(s.label || '').trim()}</span>
                        </span>
                      )}
                      {showSocial && (
                        <PosterSocialBar
                          itemId={s.id}
                          title={seasonTitle}
                          likeCount={likeInfo.count}
                          isLiked={likeInfo.liked}
                          commentsCount={commentsCount}
                          onLike={onLike}
                          onShare={onShare}
                          onOpenComments={onOpenComments}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => onOpenSeasonDetails?.(s.id)}
                            className="text-left"
                          >
                            <h3 className="font-display text-base font-semibold text-[#d4af37] hover:underline">
                              {s.seriesTitle}
                            </h3>
                          </button>
                          <p className="text-xs font-medium text-white">
                            Season {s.seasonNumber} · {seasonEpisodes.length} Episode(s)
                            {s.year ? ` · ${s.year}` : ''}
                            {s.duration ? ` · ${s.duration}` : ''}
                          </p>
                          {s.actors && (
                            <p className="mt-1 text-[11px] text-[#e0d8ef]">
                              <span className="font-semibold text-white">Actors:</span> {s.actors}
                            </p>
                          )}
                          {s.description && (
                            <p className="mt-1 text-[11px] leading-snug text-[#b0aab8] line-clamp-2">
                              {s.description}
                            </p>
                          )}
                        </div>
                        {onOpenSeasonDetails && (
                          <button
                            type="button"
                            onClick={() => onOpenSeasonDetails(s.id)}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-[#6a0dad] bg-[#171126] px-2.5 py-1 text-[11px] font-bold text-[#f0cf65]"
                          >
                            <Info className="h-3.5 w-3.5" />
                            <span>Details</span>
                          </button>
                        )}
                      </div>

                      {seasonEpisodes.length === 0 ? (
                        <div className="text-xs text-white/75">No episodes in this season yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {seasonEpisodes.map((ep) => (
                            <div
                              key={ep.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#6a0dad]/45 bg-[#09070f] px-3 py-2.5"
                            >
                              <div className="text-sm font-medium text-white">
                                Ep {ep.episodeNumber}: {ep.title}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onWatchEpisode(ep.id)}
                                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-4 py-2 text-xs font-bold text-black"
                                >
                                  {isVipLocked && <Lock className="h-3.5 w-3.5" />}
                                  <span>{isVipLocked ? 'VIP Watch' : 'Watch'}</span>
                                </button>
                                {onDownloadEpisode && (
                                  <button
                                    type="button"
                                    onClick={() => onDownloadEpisode(ep.id)}
                                    aria-label={`Download ${ep.title}`}
                                    className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-lg border border-[#d4af37] bg-[#6a0dad] px-3 py-2 text-xs font-bold text-white"
                                  >
                                    {isVipLocked ? <Lock className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                                    <span>Download</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SiteFooter
        settings={state.settings}
        onOpenInfo={onOpenInfo}
        onNotify={onNotify}
      />
    </div>
  );
};

/* --------------------------------------------------------------------------
   3B. LIVE TV VIEW
-------------------------------------------------------------------------- */
const LiveTvLogo: React.FC<{ posterRef?: string; name: string }> = ({ posterRef, name }) => {
  const src = useResolvedMedia(posterRef);
  if (!src) {
    return (
      <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border border-[#d4af37]/50 bg-gradient-to-br from-[#4a077a] to-[#120b20]">
        <Radio className="h-7 w-7 text-[#f0cf65]" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      className="h-16 w-20 shrink-0 rounded-lg border border-[#d4af37] bg-[#0a0810] object-cover"
    />
  );
};

interface LiveTvViewProps {
  state: AppState;
  onWatchChannel: (channel: LiveTvChannel) => void;
  onLike: (id: string) => void;
  onShare: (id: string) => void;
  onOpenComments: (id: string) => void;
  onOpenInfo: (type: InfoModalType) => void;
  onNotify?: (msg: string) => void;
  onAdminEditChannel?: (id: string) => void;
  onAdminDeleteChannel?: (id: string) => void;
}

export const LiveTvView: React.FC<LiveTvViewProps> = ({
  state,
  onWatchChannel,
  onLike,
  onShare,
  onOpenComments,
  onOpenInfo,
  onNotify,
  onAdminEditChannel,
  onAdminDeleteChannel,
}) => {
  const channels = state.liveTvChannels || [];
  const showSocial = state.settings.showPosterSocialBar !== false;

  return (
    <div>
      <div className="px-4 py-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#6a0dad]/50 pb-2">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-[#f0cf65]" />
            <h2 className="font-display text-lg font-semibold text-white">Live TV Channels</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d4af37]/60 bg-[#6a0dad]/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#f0cf65]">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Live
          </span>
        </div>

        {channels.length === 0 ? (
          <div className="mb-6 rounded-xl border border-dashed border-[#6a0dad] bg-[#110e1a] px-4 py-10 text-center">
            <Radio className="mx-auto mb-2.5 h-8 w-8 text-[#d4af37]" />
            <p className="text-sm font-semibold text-white">No Live TV channels added yet.</p>
            <p className="mt-1 text-xs text-white/75">
              Live TV streams added in Admin or Settings will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((ch) => {
              const likeInfo = state.likes[ch.id] || { count: 0, liked: false };
              const commentsCount = (state.comments[ch.id] || []).length;
              return (
                <article
                  key={ch.id}
                  className="flex flex-col justify-between gap-3 overflow-hidden rounded-xl border border-[#6a0dad]/70 bg-[#110e1a] shadow-lg transition-colors hover:border-[#d4af37]"
                >
                  <div className="flex flex-col gap-3 p-4 pb-0">
                    <div className="flex items-center gap-3">
                      <LiveTvLogo posterRef={ch.poster} name={ch.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#f0cf65]">
                            Live Broadcast
                          </span>
                        </div>
                        <h3 className="mt-0.5 truncate font-display text-base font-semibold text-white">
                          {ch.name}
                        </h3>
                        <p className="truncate text-xs text-[#e0d8ef]">
                          {ch.category || 'VJ EMMA Live Stream'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onWatchChannel(ch)}
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#f0cf65] to-[#d4af37] px-3 py-2 text-xs font-bold tracking-normal text-black shadow transition-transform active:scale-[0.98]"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Watch Live TV</span>
                    </button>

                    {state.isAdminLoggedIn && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => onAdminEditChannel?.(ch.id)}
                          className="min-h-[38px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-2 py-1 text-[11px] font-bold text-[#f0cf65]"
                        >
                          Edit TV Link
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdminDeleteChannel?.(ch.id)}
                          className="min-h-[38px] rounded-md bg-[#b71c1c] px-2 py-1 text-[11px] font-bold text-white"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {showSocial && (
                    <PosterSocialBar
                      itemId={ch.id}
                      title={ch.name}
                      likeCount={likeInfo.count}
                      isLiked={likeInfo.liked}
                      commentsCount={commentsCount}
                      onLike={onLike}
                      onShare={onShare}
                      onOpenComments={onOpenComments}
                      overlay={false}
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <SiteFooter
        settings={state.settings}
        onOpenInfo={onOpenInfo}
        onNotify={onNotify}
      />
    </div>
  );
};

/* --------------------------------------------------------------------------
   4. SEARCH VIEW (ONLY OPENS WHEN TAPPED AT BOTTOM)
-------------------------------------------------------------------------- */
interface SearchViewProps {
  state: AppState;
  isSubscribed?: boolean;
  onWatchMovie: (id: string) => void;
  onOpenMovieDetails?: (id: string) => void;
  onWatchEpisode: (id: string) => void;
  onLikeMovie: (id: string) => void;
  onShareMovie: (id: string) => void;
  onOpenComments: (id: string) => void;
  onAdminEditMovie?: (id: string) => void;
  onAdminDeleteMovie?: (id: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  state,
  isSubscribed = false,
  onWatchMovie,
  onOpenMovieDetails,
  onWatchEpisode,
  onLikeMovie,
  onShareMovie,
  onOpenComments,
  onAdminEditMovie,
  onAdminDeleteMovie,
}) => {
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();

  const matchedMovies = trimmed
    ? state.movies.filter(
        (m) =>
          m.title.toLowerCase().includes(trimmed) ||
          (m.category || '').toLowerCase().includes(trimmed) ||
          (m.genre || '').toLowerCase().includes(trimmed) ||
          (m.actors || '').toLowerCase().includes(trimmed) ||
          (m.description || '').toLowerCase().includes(trimmed)
      )
    : [];

  const matchedEpisodes = trimmed
    ? state.episodes.filter((ep) => ep.title.toLowerCase().includes(trimmed))
    : [];

  return (
    <div className="px-4 py-5">
      <div className="mb-4 border-b border-[#6a0dad]/50 pb-2">
        <h2 className="font-display text-lg font-extrabold text-white">Search Movies & Series</h2>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="mb-5 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type movie, genre, or series title..."
          className="w-full min-h-[44px] rounded-lg border border-[#6a0dad] bg-[#08070d] px-3 py-2.5 text-sm text-white placeholder-white/50 focus:border-[#d4af37] focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-[44px] shrink-0 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-5 py-2 text-sm font-black text-black"
        >
          Go
        </button>
      </form>

      {!trimmed ? (
        <div className="rounded-xl border border-dashed border-[#6a0dad] bg-[#110e1a] px-4 py-8 text-center text-sm font-medium text-white/80">
          Enter a movie or series name above to search.
        </div>
      ) : (
        <>
          <MoviesGrid
            movies={matchedMovies}
            emptyText="No matching movies found."
            state={state}
            isSubscribed={isSubscribed}
            onWatch={onWatchMovie}
            onOpenDetails={onOpenMovieDetails}
            onLike={onLikeMovie}
            onShare={onShareMovie}
            onOpenComments={onOpenComments}
            onAdminEdit={onAdminEditMovie}
            onAdminDelete={onAdminDeleteMovie}
          />

          {matchedEpisodes.length > 0 && (
            <div className="mt-4">
              <div className="mb-3 border-b border-[#6a0dad]/50 pb-2">
                <h3 className="font-display text-base font-extrabold text-white">Matching Episodes</h3>
              </div>
              <div className="space-y-2">
                {matchedEpisodes.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#6a0dad]/50 bg-[#110e1a] px-3 py-2.5"
                  >
                    <div className="text-sm font-bold text-white">
                      Episode {ep.episodeNumber}: {ep.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => onWatchEpisode(ep.id)}
                      className="min-h-[40px] shrink-0 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-4 py-2 text-xs font-black text-black"
                    >
                      Watch
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* --------------------------------------------------------------------------
   5. PROFILE VIEW
-------------------------------------------------------------------------- */
interface ProfileViewProps {
  state: AppState;
  isSubscribed: boolean;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onNotify?: (msg: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  state,
  isSubscribed,
  onOpenAuth,
  onLogout,
  onOpenAdmin,
  onNotify,
}) => {
  const liveAccount = state.currentUser && state.currentUser.role !== 'admin'
    ? state.users.find(
        (u) =>
          (state.currentUser?.id && u.id === state.currentUser.id) ||
          u.email.toLowerCase() === state.currentUser?.email.toLowerCase() ||
          u.phone === state.currentUser?.phone
      )
    : undefined;

  const effectiveExpiry = liveAccount?.expiry || state.currentUser?.expiry || 0;
  const expiryStr = effectiveExpiry ? new Date(effectiveExpiry).toLocaleString() : '-';
  const effectiveStatus = liveAccount?.status || state.currentUser?.status;
  const wasSubscribedExpired = Boolean(
    effectiveStatus !== 'blocked' &&
      !isSubscribed &&
      (liveAccount?.subscribed || state.currentUser?.subscribed) &&
      effectiveExpiry > 0 &&
      effectiveExpiry <= Date.now()
  );

  return (
    <div className="px-4 py-5">
      <div className="mb-3 border-b border-[#6a0dad]/50 pb-2">
        <h2 className="font-display text-lg font-extrabold text-white">My Profile</h2>
      </div>

      {!state.currentUser ? (
        <div className="mb-6 rounded-xl border border-[#6a0dad] bg-[#110e1a] p-4">
          <h3 className="mb-2 font-display text-base font-extrabold text-[#d4af37]">
            Customer Account
          </h3>
          <p className="mb-3.5 text-sm text-white/85">
            Sign in with your Phone, Email, and Password to manage your account and watch movies.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] w-full rounded-lg bg-gradient-to-r from-[#6a0dad] to-[#4a077a] border border-[#d4af37] px-4 py-2.5 text-sm font-extrabold text-white"
          >
            Sign In
          </button>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-[#6a0dad] bg-[#110e1a] p-4">
          <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
            Account Details
          </h3>
          <div className="space-y-1.5 text-sm text-white">
            {(liveAccount?.name || state.currentUser.name) && (
              <div>
                <span className="font-bold text-[#f0cf65]">Name:</span>{' '}
                {liveAccount?.name || state.currentUser.name}
              </div>
            )}
            <div>
              <span className="font-bold text-[#f0cf65]">Phone:</span> {state.currentUser.phone}
            </div>
            <div>
              <span className="font-bold text-[#f0cf65]">Email:</span> {state.currentUser.email}
            </div>
            <div>
              <span className="font-bold text-[#f0cf65]">Subscription:</span>{' '}
              {effectiveStatus === 'blocked' ? (
                <span className="font-bold text-rose-400">Blocked by Admin</span>
              ) : effectiveStatus === 'pending' && !isSubscribed ? (
                <span className="font-bold text-amber-300">
                  Pending WhatsApp Approval
                  {liveAccount?.pendingPlan ? ` (${liveAccount.pendingPlan})` : ''}
                </span>
              ) : isSubscribed ? (
                <span className="font-bold text-emerald-400">
                  Active ({liveAccount?.plan || state.currentUser.plan} until {expiryStr})
                </span>
              ) : wasSubscribedExpired ? (
                <span className="font-bold text-amber-300">
                  Expired ({expiryStr}) — Tap any movie poster to subscribe
                </span>
              ) : (
                <span className="font-bold text-rose-400">
                  Not Subscribed — Tap any movie poster to subscribe
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {state.isAdminLoggedIn && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="min-h-[44px] rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-bold text-white"
              >
                Open Admin Panel
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] rounded-lg bg-[#b71c1c] px-4 py-2 text-xs font-bold text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* INSTALL APP CARD FOR SMARTPHONES, COMPUTERS & IPHONES */}
      <div className="mb-6 rounded-xl border border-[#d4af37]/50 bg-gradient-to-br from-[#191129] to-[#0f0b17] p-4">
        <h3 className="mb-1.5 font-display text-base font-extrabold text-[#f0cf65]">
          Install VJ EMMA App
        </h3>
        <p className="mb-3 text-xs text-white/85">
          Install directly on your Android smartphone, computer (Windows/Mac), or iPhone/iPad for instant full-screen streaming.
        </p>
        <PWAInstallButton variant="card" />
      </div>

      {/* FOLLOW & CONTACT US ON SOCIAL PLATFORMS */}
      <div className="mb-6 rounded-xl border border-[#6a0dad]/70 bg-[#110e1a] p-4">
        <h3 className="mb-1.5 font-display text-base font-semibold text-[#f0cf65]">
          Follow &amp; Contact Us
        </h3>
        <p className="mb-3 text-xs text-white/80">
          Connect with VJ EMMA - TRUE LIGHT PRODUCTION on WhatsApp, YouTube, Facebook, and TikTok.
        </p>
        <SocialPlatformsRow settings={state.settings} onNotify={onNotify} />
      </div>
    </div>
  );
};
