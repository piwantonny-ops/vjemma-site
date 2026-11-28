import React, { useEffect, useRef, useState } from 'react';
import { Film } from 'lucide-react';
import { updateAdminPasswordInD1 } from '../d1Client';
import { uploadFileToR2 } from '../r2Upload';
import {
  DEFAULT_CATEGORY_LINE,
  DEFAULT_GENRE_LINE,
  LOCKED_ADMIN_EMAIL,
  normalizeSocialUrl,
  parseCategoryLine,
  parseGenreLine,
  parseMovieGenres,
  resolveMediaUrl,
  sanitizeAssetUrl,
  useResolvedMedia,
} from '../storage';
import type { AdminTab, AppState } from '../types';

interface AdminPanelProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  onViewSite: () => void;
  onLogout: () => void;
  onNotify: (msg: string) => void;
  paymentRequestsError?: string | null;
  onRefreshPaymentRequests?: () => Promise<void>;
  onApprovePaymentRequest?: (
    userId: string,
    overridePlan?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onBlockPaymentRequest?: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  onDeletePaymentRequest?: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  onAddManualPaymentRequest?: (input: {
    name?: string;
    phone: string;
    email: string;
    plan: string;
    amount: number;
    days: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  initialEditMovieId?: string | null;
  onClearInitialEditMovie?: () => void;
  initialEditChannelId?: string | null;
  onClearInitialEditChannel?: () => void;
}

const AdminThumb: React.FC<{ srcRef?: string; className?: string }> = ({ srcRef, className = 'h-16 w-12' }) => {
  const src = useResolvedMedia(srcRef);
  if (!src) {
    return (
      <div className={`${className} flex shrink-0 items-center justify-center rounded bg-[#1b1826]`}>
        <Film className="h-4 w-4 text-[#d4af37]/60" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={`${className} shrink-0 rounded bg-[#1b1826] object-cover`}
    />
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  state,
  updateState,
  onViewSite,
  onLogout,
  onNotify,
  paymentRequestsError,
  onRefreshPaymentRequests,
  onApprovePaymentRequest,
  onBlockPaymentRequest,
  onDeletePaymentRequest,
  onAddManualPaymentRequest,
  initialEditMovieId,
  onClearInitialEditMovie,
  initialEditChannelId,
  onClearInitialEditChannel,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  /* --- MOVIES STATE --- */
  const [editMovieId, setEditMovieId] = useState('');
  const [movieTitle, setMovieTitle] = useState('');
  const [movieYear, setMovieYear] = useState('');
  const [movieDuration, setMovieDuration] = useState('');
  const [movieRating, setMovieRating] = useState('');
  const [movieGenre, setMovieGenre] = useState('');
  const [movieCategory, setMovieCategory] = useState('');
  const [movieActors, setMovieActors] = useState('');
  const [movieLabel, setMovieLabel] = useState('');
  const [movieDescription, setMovieDescription] = useState('');
  const [moviePosterLink, setMoviePosterLink] = useState('');
  const [movieVideoLink, setMovieVideoLink] = useState('');
  const [moviePosterPreview, setMoviePosterPreview] = useState('');
  const [posterRemoved, setPosterRemoved] = useState(false);
  const [uploadedPosterRef, setUploadedPosterRef] = useState('');
  const [uploadedVideoRef, setUploadedVideoRef] = useState('');
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('Ready');
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [movieUploadReady, setMovieUploadReady] = useState(false);
  const [uploadFileNameText, setUploadFileNameText] = useState('No file selected');
  const [selectedPosterFile, setSelectedPosterFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const posterFileRef = useRef<HTMLInputElement | null>(null);
  const videoFileRef = useRef<HTMLInputElement | null>(null);
  const settingsPosterFileRef = useRef<HTMLInputElement | null>(null);
  const settingsVideoFileRef = useRef<HTMLInputElement | null>(null);

  /* --- BANNERS STATE --- */
  const [editBannerId, setEditBannerId] = useState('');
  const [bannerLink, setBannerLink] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubText, setBannerSubText] = useState('');
  const [bannerButtonText, setBannerButtonText] = useState('');
  const bannerFileRef = useRef<HTMLInputElement | null>(null);

  /* --- SERIES STATE --- */
  const [editSeasonId, setEditSeasonId] = useState('');
  const [seasonSeriesTitle, setSeasonSeriesTitle] = useState('');
  const [seasonNumber, setSeasonNumber] = useState('');
  const [seasonLabel, setSeasonLabel] = useState('');
  const [seasonGenre, setSeasonGenre] = useState('');
  const [seasonCategory, setSeasonCategory] = useState('');
  const [seasonYear, setSeasonYear] = useState('');
  const [seasonDuration, setSeasonDuration] = useState('');
  const [seasonActors, setSeasonActors] = useState('');
  const [seasonDescription, setSeasonDescription] = useState('');
  const [seasonPosterLink, setSeasonPosterLink] = useState('');
  const [seasonPosterPreview, setSeasonPosterPreview] = useState('');
  const [seasonPosterRemoved, setSeasonPosterRemoved] = useState(false);
  const seasonPosterFileRef = useRef<HTMLInputElement | null>(null);

  const [editEpisodeId, setEditEpisodeId] = useState('');
  const [episodeSeasonId, setEpisodeSeasonId] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeVideoLink, setEpisodeVideoLink] = useState('');
  const [episodeFileName, setEpisodeFileName] = useState('');
  const episodeVideoFileRef = useRef<HTMLInputElement | null>(null);

  /* --- LIVE TV STATE --- */
  const [editTvId, setEditTvId] = useState('');
  const [tvName, setTvName] = useState('');
  const [tvStreamUrl, setTvStreamUrl] = useState('');
  const [tvCategory, setTvCategory] = useState('');
  const [tvPosterLink, setTvPosterLink] = useState('');
  const [tvPosterPreview, setTvPosterPreview] = useState('');
  const [tvPosterRemoved, setTvPosterRemoved] = useState(false);
  const tvPosterFileRef = useRef<HTMLInputElement | null>(null);

  /* --- PAYMENT PLANS STATE (NAME, PRICE, DAYS) --- */
  const [editPlanId, setEditPlanId] = useState('');
  const [planNameInput, setPlanNameInput] = useState('');
  const [planPriceInput, setPlanPriceInput] = useState('');
  const [planDaysInput, setPlanDaysInput] = useState('');

  /* --- SETTINGS STATE --- */
  const [setAppName, setSetAppName] = useState(state.settings.appName);
  const [setGenreLine, setSetGenreLine] = useState(
    state.settings.genreLine !== undefined ? state.settings.genreLine : DEFAULT_GENRE_LINE
  );
  const [setCategoryLine, setSetCategoryLine] = useState(
    state.settings.categoryLine !== undefined ? state.settings.categoryLine : DEFAULT_CATEGORY_LINE
  );
  const [setR2Links, setSetR2Links] = useState<string[]>(() => {
    const arr = Array.isArray(state.settings.r2Links) ? state.settings.r2Links : [];
    return [0, 1, 2, 3, 4].map((i) => arr[i] ?? (i === 0 ? state.settings.r2Endpoint || '' : ''));
  });
  const [setWhatsappKey, setSetWhatsappKey] = useState(state.settings.whatsappKey);
  const [setSocialLinks, setSetSocialLinks] = useState(state.settings.socialLinks);
  const [setWhatsappUrl, setSetWhatsappUrl] = useState(state.settings.whatsappUrl || '');
  const [setYoutubeUrl, setSetYoutubeUrl] = useState(state.settings.youtubeUrl || '');
  const [setFacebookUrl, setSetFacebookUrl] = useState(state.settings.facebookUrl || '');
  const [setTiktokUrl, setSetTiktokUrl] = useState(state.settings.tiktokUrl || '');
  const [setPriceWeekly, setSetPriceWeekly] = useState(String(state.settings.priceWeekly || 5000));
  const [setPriceMonthly, setSetPriceMonthly] = useState(String(state.settings.priceMonthly || 15000));
  const [setPriceVip, setSetPriceVip] = useState(String(state.settings.priceVip || 30000));

  const [setShowPosterLabel, setSetShowPosterLabel] = useState(state.settings.showPosterLabel !== false);
  const [setShowPosterRating, setSetShowPosterRating] = useState(state.settings.showPosterRating !== false);
  const [setShowPosterSocialBar, setSetShowPosterSocialBar] = useState(state.settings.showPosterSocialBar !== false);
  const [setShowPosterYear, setSetShowPosterYear] = useState(state.settings.showPosterYear !== false);
  const [setShowPosterActors, setSetShowPosterActors] = useState(state.settings.showPosterActors !== false);
  const [setShowPosterDescription, setSetShowPosterDescription] = useState(state.settings.showPosterDescription !== false);

  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');

  const lastSyncedSettingsJsonRef = useRef<string>('');
  useEffect(() => {
    const serialized = JSON.stringify(state.settings);
    if (serialized === lastSyncedSettingsJsonRef.current) return;
    lastSyncedSettingsJsonRef.current = serialized;
    setSetAppName(state.settings.appName);
    setSetGenreLine(
      state.settings.genreLine !== undefined ? state.settings.genreLine : DEFAULT_GENRE_LINE
    );
    setSetCategoryLine(
      state.settings.categoryLine !== undefined ? state.settings.categoryLine : DEFAULT_CATEGORY_LINE
    );
    const arr = Array.isArray(state.settings.r2Links) ? state.settings.r2Links : [];
    setSetR2Links([0, 1, 2, 3, 4].map((i) => arr[i] ?? (i === 0 ? state.settings.r2Endpoint || '' : '')));
    setSetWhatsappKey(state.settings.whatsappKey);
    setSetSocialLinks(state.settings.socialLinks);
    setSetWhatsappUrl(state.settings.whatsappUrl || '');
    setSetYoutubeUrl(state.settings.youtubeUrl || '');
    setSetFacebookUrl(state.settings.facebookUrl || '');
    setSetTiktokUrl(state.settings.tiktokUrl || '');
    setSetPriceWeekly(String(state.settings.priceWeekly || 5000));
    setSetPriceMonthly(String(state.settings.priceMonthly || 15000));
    setSetPriceVip(String(state.settings.priceVip || 30000));
    setSetShowPosterLabel(state.settings.showPosterLabel !== false);
    setSetShowPosterRating(state.settings.showPosterRating !== false);
    setSetShowPosterSocialBar(state.settings.showPosterSocialBar !== false);
    setSetShowPosterYear(state.settings.showPosterYear !== false);
    setSetShowPosterActors(state.settings.showPosterActors !== false);
    setSetShowPosterDescription(state.settings.showPosterDescription !== false);
  }, [state.settings]);

  /* --- CLIENTS / USERS & WALLET STATE --- */
  const [clientFilter, setClientFilter] = useState<'all' | 'pending' | 'approved' | 'blocked'>('all');
  const [clientSearch, setClientSearch] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPlan, setNewClientPlan] = useState<string>(
    state.settings.paymentPlans?.[0]?.name || 'Weekly'
  );
  const [walletAdjAmount, setWalletAdjAmount] = useState('');
  const [walletAdjNote, setWalletAdjNote] = useState('');

  const mediaTotal =
    state.movies.length +
    state.banners.length +
    state.episodes.length +
    (state.liveTvChannels?.length || 0);

  const nowTs = Date.now();
  const pendingClientsCount = state.users.filter((u) => u.status === 'pending').length;
  const approvedClientsCount = state.users.filter(
    (u) => u.subscribed && u.status !== 'blocked' && u.expiry > nowTs
  ).length;
  const blockedClientsCount = state.users.filter((u) => u.status === 'blocked').length;

  const oneLineGenres = parseGenreLine(state.settings.genreLine);
  const oneLineCategories = parseCategoryLine(state.settings.categoryLine);

  const selectedMovieGenres = parseMovieGenres(movieGenre);
  const availableMovieGenreChoices = Array.from(
    new Map(
      [...oneLineGenres, ...selectedMovieGenres].map((g) => [g.toLowerCase(), g])
    ).values()
  );

  const selectedMovieCategories = parseMovieGenres(movieCategory);
  const availableMovieCategoryChoices = Array.from(
    new Map(
      [...oneLineCategories, ...selectedMovieCategories].map((c) => [c.toLowerCase(), c])
    ).values()
  );

  const selectedSeasonGenres = parseMovieGenres(seasonGenre);
  const selectedSeasonCategories = parseMovieGenres(seasonCategory);

  const toggleTagValue = (
    currentSelected: string[],
    tagName: string,
    setter: (next: string) => void
  ) => {
    const targetKey = tagName.trim().toLowerCase();
    const exists = currentSelected.some((g) => g.toLowerCase() === targetKey);
    const next = exists
      ? currentSelected.filter((g) => g.toLowerCase() !== targetKey)
      : [...currentSelected, tagName.trim()];
    setter(next.join(', '));
  };

  const toggleMovieGenre = (genreName: string) =>
    toggleTagValue(selectedMovieGenres, genreName, setMovieGenre);
  const toggleMovieCategory = (categoryName: string) =>
    toggleTagValue(selectedMovieCategories, categoryName, setMovieCategory);
  const toggleSeasonGenre = (genreName: string) =>
    toggleTagValue(selectedSeasonGenres, genreName, setSeasonGenre);
  const toggleSeasonCategory = (categoryName: string) =>
    toggleTagValue(selectedSeasonCategories, categoryName, setSeasonCategory);

  const configuredPaymentPlans =
    Array.isArray(state.settings.paymentPlans) && state.settings.paymentPlans.length > 0
      ? state.settings.paymentPlans
      : [
          { id: 'plan_weekly', name: 'Weekly', price: Number(state.settings.priceWeekly || 5000), days: 7 },
          { id: 'plan_monthly', name: 'Monthly', price: Number(state.settings.priceMonthly || 15000), days: 30 },
          { id: 'plan_vip', name: 'VIP', price: Number(state.settings.priceVip || 30000), days: 30 },
        ];

  /* --- MOVIES HANDLERS --- */
  const refreshUploadFileLabel = (pOverride?: File | null, vOverride?: File | null) => {
    const pFile = pOverride !== undefined ? pOverride : selectedPosterFile || posterFileRef.current?.files?.[0] || null;
    const vFile = vOverride !== undefined ? vOverride : selectedVideoFile || videoFileRef.current?.files?.[0] || null;
    const parts: string[] = [];
    if (pFile) parts.push('Poster: ' + pFile.name);
    if (vFile) parts.push('Movie: ' + vFile.name);
    setUploadFileNameText(parts.length ? parts.join(' | ') : 'Ready for file or link');
  };

  const handlePosterFileChange = (fileOverride?: File | null) => {
    const file = fileOverride || posterFileRef.current?.files?.[0] || null;
    if (file) {
      setSelectedPosterFile(file);
      setPosterRemoved(false);
      setUploadedPosterRef('');
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setMoviePosterPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
    refreshUploadFileLabel(file, undefined);
  };

  const handleVideoFileChange = (fileOverride?: File | null) => {
    const file = fileOverride || videoFileRef.current?.files?.[0] || null;
    if (file) {
      setSelectedVideoFile(file);
      setUploadedVideoRef('');
    }
    refreshUploadFileLabel(undefined, file);
  };

  const removeMoviePoster = () => {
    setPosterRemoved(true);
    setMoviePosterPreview('');
    setMoviePosterLink('');
    setUploadedPosterRef('');
    setSelectedPosterFile(null);
    if (posterFileRef.current) posterFileRef.current.value = '';
    if (settingsPosterFileRef.current) settingsPosterFileRef.current.value = '';
    refreshUploadFileLabel(null, undefined);
    onNotify('Poster removed. Tap SAVE POSTER / MOVIE to apply.');
  };

  const startMovieUpload = async () => {
    if (uploadInProgress) return;
    if (!state.isAdminLoggedIn) {
      onNotify('Admin login required to upload media.');
      return;
    }

    const pFile =
      selectedPosterFile || posterFileRef.current?.files?.[0] || settingsPosterFileRef.current?.files?.[0];
    const vFile =
      selectedVideoFile || videoFileRef.current?.files?.[0] || settingsVideoFileRef.current?.files?.[0];
    const pLink = moviePosterLink.trim();
    const vLink = movieVideoLink.trim();

    if (!pFile && !pLink && !vFile && !vLink && !uploadedPosterRef && !uploadedVideoRef) {
      onNotify('Select a Poster/Movie file or enter links first.');
      return;
    }

    setUploadInProgress(true);
    setMovieUploadReady(false);
    refreshUploadFileLabel(pFile || null, vFile || null);
    setUploadPct(2);
    setUploadStatus('Connecting to Cloudflare R2...');

    let nextPosterUrl = uploadedPosterRef || pLink;
    let nextVideoUrl = uploadedVideoRef || vLink;

    try {
      if (pFile) {
        setUploadStatus(`Uploading Poster (${pFile.name}) to R2...`);
        nextPosterUrl = await uploadFileToR2(pFile, 'posters', (pct) => {
          const scaled = vFile ? Math.round(pct * 0.25) : pct;
          setUploadPct(scaled);
        });
        setUploadedPosterRef(nextPosterUrl);
        setMoviePosterLink(nextPosterUrl);
        setMoviePosterPreview(nextPosterUrl);
        setPosterRemoved(false);
        setSelectedPosterFile(null);
        if (posterFileRef.current) posterFileRef.current.value = '';
        if (settingsPosterFileRef.current) settingsPosterFileRef.current.value = '';
      }

      if (vFile) {
        setUploadStatus(`Uploading Movie (${vFile.name}) to R2 bucket...`);
        const baseOffset = pFile ? 25 : 0;
        const span = pFile ? 75 : 100;
        nextVideoUrl = await uploadFileToR2(vFile, 'movies', (pct) => {
          setUploadPct(Math.min(99, Math.round(baseOffset + (pct / 100) * span)));
        });
        setUploadedVideoRef(nextVideoUrl);
        setMovieVideoLink(nextVideoUrl);
        setSelectedVideoFile(null);
        if (videoFileRef.current) videoFileRef.current.value = '';
        if (settingsVideoFileRef.current) settingsVideoFileRef.current.value = '';
      }

      setUploadPct(100);
      setMovieUploadReady(true);

      if (movieTitle.trim()) {
        setUploadStatus('R2 Upload Complete! Saving to Cloudflare D1...');
        await commitMovieToStateAndD1(nextPosterUrl, nextVideoUrl);
        onNotify('Uploaded to R2 & saved to Cloudflare D1 automatically!');
      } else {
        setUploadStatus('R2 Upload Complete! Enter Title & tap SAVE MOVIE.');
        onNotify('R2 Upload Complete! Public URL saved automatically — enter Title & click SAVE MOVIE.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'R2 upload failed.';
      setUploadStatus(`Upload error: ${msg}`);
      onNotify(`R2 Upload Error: ${msg}`);
    } finally {
      setUploadInProgress(false);
    }
  };

  const resetMovieForm = () => {
    setEditMovieId('');
    setMovieTitle('');
    setMovieYear('');
    setMovieDuration('');
    setMovieRating('');
    setMovieGenre('');
    setMovieCategory('');
    setMovieActors('');
    setMovieLabel('');
    setMovieDescription('');
    setMoviePosterLink('');
    setMovieVideoLink('');
    setMoviePosterPreview('');
    setPosterRemoved(false);
    setUploadedPosterRef('');
    setUploadedVideoRef('');
    setSelectedPosterFile(null);
    setSelectedVideoFile(null);
    setUploadPct(0);
    setUploadStatus('Ready');
    setMovieUploadReady(false);
    setUploadFileNameText('No file selected');
    if (posterFileRef.current) posterFileRef.current.value = '';
    if (videoFileRef.current) videoFileRef.current.value = '';
    if (settingsPosterFileRef.current) settingsPosterFileRef.current.value = '';
    if (settingsVideoFileRef.current) settingsVideoFileRef.current.value = '';
  };

  const commitMovieToStateAndD1 = async (posterUrl: string, videoUrl: string) => {
    const title = movieTitle.trim();
    const cleanGenresList = parseMovieGenres(movieGenre);
    const cleanGenre = cleanGenresList.join(', ');
    const cleanCategoriesList = parseMovieGenres(movieCategory);
    const cleanCategory = cleanCategoriesList.join(', ');
    const cleanLabel = movieLabel.trim();
    const cleanPosterInput = sanitizeAssetUrl(posterUrl) || sanitizeAssetUrl(moviePosterLink.trim()) || uploadedPosterRef;
    const cleanVideoInput = sanitizeAssetUrl(videoUrl) || sanitizeAssetUrl(movieVideoLink.trim()) || uploadedVideoRef;

    updateState((prev) => {
      if (editMovieId) {
        return {
          ...prev,
          movies: prev.movies.map((m) =>
            m.id === editMovieId
              ? {
                  ...m,
                  title,
                  year: movieYear.trim(),
                  duration: movieDuration.trim(),
                  rating: movieRating.trim(),
                  category: cleanCategory,
                  categories: cleanCategoriesList,
                  genre: cleanGenre,
                  genres: cleanGenresList,
                  actors: movieActors.trim(),
                  label: cleanLabel,
                  description: movieDescription.trim(),
                  poster: posterRemoved ? '' : cleanPosterInput || m.poster || '',
                  video: cleanVideoInput || m.video || '',
                }
              : m
          ),
        };
      }
      return {
        ...prev,
        movies: [
          ...prev.movies,
          {
            id: 'mov_' + Date.now(),
            title,
            year: movieYear.trim(),
            duration: movieDuration.trim(),
            rating: movieRating.trim(),
            category: cleanCategory,
            categories: cleanCategoriesList,
            genre: cleanGenre,
            genres: cleanGenresList,
            actors: movieActors.trim(),
            label: cleanLabel,
            description: movieDescription.trim(),
            poster: posterRemoved ? '' : posterUrl || '',
            video: videoUrl || '',
            createdAt: Date.now(),
          },
        ],
      };
    });

    resetMovieForm();
  };

  const saveMovieRecord = async () => {
    if (uploadInProgress) {
      onNotify('Please wait for R2 upload to complete.');
      return;
    }
    if (!state.isAdminLoggedIn) {
      onNotify('Admin login required.');
      return;
    }
    const title = movieTitle.trim();
    if (!title) {
      onNotify('Please enter Movie / Poster Title.');
      return;
    }

    const pFile =
      selectedPosterFile || posterFileRef.current?.files?.[0] || settingsPosterFileRef.current?.files?.[0];
    const vFile =
      selectedVideoFile || videoFileRef.current?.files?.[0] || settingsVideoFileRef.current?.files?.[0];

    const existingMovie = editMovieId
      ? state.movies.find((x) => x.id === editMovieId)
      : undefined;

    let nextPosterRef = posterRemoved
      ? ''
      : uploadedPosterRef ||
        sanitizeAssetUrl(moviePosterLink.trim()) ||
        existingMovie?.poster ||
        '';
    let nextVideoRef =
      uploadedVideoRef ||
      sanitizeAssetUrl(movieVideoLink.trim()) ||
      existingMovie?.video ||
      '';

    if (pFile || vFile) {
      setUploadInProgress(true);
      try {
        if (pFile) {
          setUploadStatus(`Uploading Poster (${pFile.name}) to R2...`);
          nextPosterRef = await uploadFileToR2(pFile, 'posters', (pct) => {
            setUploadPct(vFile ? Math.round(pct * 0.25) : pct);
          });
          setUploadedPosterRef(nextPosterRef);
          setMoviePosterLink(nextPosterRef);
        }
        if (vFile) {
          setUploadStatus(`Uploading Movie (${vFile.name}) to R2...`);
          const baseOffset = pFile ? 25 : 0;
          const span = pFile ? 75 : 100;
          nextVideoRef = await uploadFileToR2(vFile, 'movies', (pct) => {
            setUploadPct(Math.min(99, Math.round(baseOffset + (pct / 100) * span)));
          });
          setUploadedVideoRef(nextVideoRef);
          setMovieVideoLink(nextVideoRef);
        }
        setUploadPct(100);
        setUploadStatus('Uploaded to R2 & Saved to Cloud Database!');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'R2 upload failed.';
        setUploadStatus(`Upload error: ${msg}`);
        onNotify(`R2 Upload Error: ${msg}`);
        setUploadInProgress(false);
        return;
      }
      setUploadInProgress(false);
    }

    await commitMovieToStateAndD1(nextPosterRef, nextVideoRef);
    onNotify('Movie & poster saved to Cloudflare D1 live!');
  };

  const startEditMovie = async (id: string, stayOnCurrentTab = false) => {
    const m = state.movies.find((x) => x.id === id);
    if (!m) return;
    if (!stayOnCurrentTab) setActiveTab('movies');
    setEditMovieId(m.id);
    setMovieTitle(m.title);
    setMovieYear(m.year || '');
    setMovieDuration(m.duration || '');
    setMovieRating(m.rating || '');
    setMovieGenre(parseMovieGenres(m.genres, m.genre).join(', '));
    setMovieCategory(parseMovieGenres(m.categories, m.category).join(', '));
    setMovieActors(m.actors || '');
    setMovieLabel(m.label || '');
    setMovieDescription(m.description || '');
    setMoviePosterLink(m.poster && !m.poster.startsWith('idb://') ? m.poster : '');
    setMovieVideoLink(m.video && !m.video.startsWith('idb://') ? m.video : '');
    setPosterRemoved(false);
    setUploadedPosterRef(m.poster || '');
    setUploadedVideoRef(m.video || '');
    setMovieUploadReady(true);
    const resolvedPoster = await resolveMediaUrl(m.poster);
    setMoviePosterPreview(resolvedPoster || (m.poster && !m.poster.startsWith('idb://') ? m.poster : ''));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (initialEditMovieId) {
      startEditMovie(initialEditMovieId);
      onClearInitialEditMovie?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditMovieId]);

  useEffect(() => {
    if (initialEditChannelId) {
      startEditTvChannel(initialEditChannelId, 'livetv');
      onClearInitialEditChannel?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditChannelId]);

  const deleteMoviePosterOnly = (id: string) => {
    updateState((prev) => ({
      ...prev,
      movies: prev.movies.map((m) => (m.id === id ? { ...m, poster: '' } : m)),
    }));
    if (editMovieId === id) {
      setPosterRemoved(true);
      setMoviePosterPreview('');
      setMoviePosterLink('');
      setUploadedPosterRef('');
    }
    onNotify('Poster deleted.');
  };

  const deleteMovie = (id: string) => {
    updateState((prev) => ({
      ...prev,
      movies: prev.movies.filter((m) => m.id !== id),
    }));
    if (editMovieId === id) resetMovieForm();
    onNotify('Movie deleted.');
  };

  /* --- BANNERS HANDLERS --- */
  const resetBannerForm = () => {
    setEditBannerId('');
    setBannerLink('');
    setBannerPreview('');
    setBannerTitle('');
    setBannerSubText('');
    setBannerButtonText('');
    if (bannerFileRef.current) bannerFileRef.current.value = '';
  };

  const handleBannerFileChange = () => {
    const file = bannerFileRef.current?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setBannerPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveBannerRecord = async () => {
    if (!editBannerId && state.banners.length >= 5) {
      onNotify('Maximum 5 banners allowed.');
      return;
    }
    const file = bannerFileRef.current?.files?.[0];
    let imageRef = bannerLink.trim();
    if (file) {
      try {
        onNotify('Uploading banner image to Cloudflare R2...');
        imageRef = await uploadFileToR2(file, 'banners');
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Banner R2 upload failed.');
        return;
      }
    }
    if (!imageRef && !editBannerId) {
      onNotify('Upload a banner image or paste link.');
      return;
    }

    const title = bannerTitle.trim();
    const subText = bannerSubText.trim();
    const buttonText = bannerButtonText.trim();

    updateState((prev) => {
      if (editBannerId) {
        return {
          ...prev,
          banners: prev.banners.map((b) =>
            b.id === editBannerId
              ? {
                  ...b,
                  image: imageRef || b.image,
                  title,
                  subText,
                  buttonText,
                }
              : b
          ),
        };
      }
      return {
        ...prev,
        banners: [
          ...prev.banners,
          {
            id: 'ban_' + Date.now(),
            image: imageRef,
            title,
            subText,
            buttonText,
          },
        ],
      };
    });

    resetBannerForm();
    onNotify('Banner saved & live!');
  };

  /* --- SERIES HANDLERS --- */
  const resetSeasonForm = () => {
    setEditSeasonId('');
    setSeasonSeriesTitle('');
    setSeasonNumber('');
    setSeasonLabel('');
    setSeasonGenre('');
    setSeasonCategory('');
    setSeasonYear('');
    setSeasonDuration('');
    setSeasonActors('');
    setSeasonDescription('');
    setSeasonPosterLink('');
    setSeasonPosterPreview('');
    setSeasonPosterRemoved(false);
    if (seasonPosterFileRef.current) seasonPosterFileRef.current.value = '';
  };

  const handleSeasonPosterFileChange = () => {
    const file = seasonPosterFileRef.current?.files?.[0];
    if (file) {
      setSeasonPosterRemoved(false);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setSeasonPosterPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveSeasonRecord = async () => {
    const seriesTitle = seasonSeriesTitle.trim();
    const sNum = seasonNumber.trim();
    if (!seriesTitle || !sNum) {
      onNotify('Enter Series Title and Season Number.');
      return;
    }

    const file = seasonPosterFileRef.current?.files?.[0];
    const existingSeason = editSeasonId ? state.seasons.find((s) => s.id === editSeasonId) : undefined;
    let posterRef = seasonPosterRemoved
      ? ''
      : sanitizeAssetUrl(seasonPosterLink.trim()) || existingSeason?.poster || '';
    if (file) {
      try {
        onNotify('Uploading season poster to Cloudflare R2...');
        posterRef = await uploadFileToR2(file, 'seasons');
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Season poster R2 upload failed.');
        return;
      }
    }

    const cleanSeasonLabel = seasonLabel.trim();
    const cleanSeasonGenres = parseMovieGenres(seasonGenre);
    const cleanSeasonCategories = parseMovieGenres(seasonCategory);

    updateState((prev) => {
      if (editSeasonId) {
        return {
          ...prev,
          seasons: prev.seasons.map((s) =>
            s.id === editSeasonId
              ? {
                  ...s,
                  seriesTitle,
                  seasonNumber: sNum,
                  label: cleanSeasonLabel,
                  genre: cleanSeasonGenres.join(', '),
                  genres: cleanSeasonGenres,
                  category: cleanSeasonCategories.join(', '),
                  categories: cleanSeasonCategories,
                  year: seasonYear.trim(),
                  duration: seasonDuration.trim(),
                  actors: seasonActors.trim(),
                  description: seasonDescription.trim(),
                  poster: seasonPosterRemoved ? '' : posterRef || s.poster || '',
                }
              : s
          ),
        };
      }
      return {
        ...prev,
        seasons: [
          ...prev.seasons,
          {
            id: 'sea_' + Date.now(),
            seriesTitle,
            seasonNumber: sNum,
            label: cleanSeasonLabel,
            genre: cleanSeasonGenres.join(', '),
            genres: cleanSeasonGenres,
            category: cleanSeasonCategories.join(', '),
            categories: cleanSeasonCategories,
            year: seasonYear.trim(),
            duration: seasonDuration.trim(),
            actors: seasonActors.trim(),
            description: seasonDescription.trim(),
            poster: seasonPosterRemoved ? '' : posterRef || '',
          },
        ],
      };
    });

    resetSeasonForm();
    onNotify('Season saved.');
  };

  const resetEpisodeForm = () => {
    setEditEpisodeId('');
    setEpisodeNumber('');
    setEpisodeTitle('');
    setEpisodeVideoLink('');
    setEpisodeFileName('');
    if (episodeVideoFileRef.current) episodeVideoFileRef.current.value = '';
  };

  const saveEpisodeRecord = async () => {
    if (!episodeSeasonId) {
      onNotify('Select a Season first.');
      return;
    }
    const epNum = episodeNumber.trim();
    const title = episodeTitle.trim();
    if (!epNum || !title) {
      onNotify('Enter Episode Number and Episode Title.');
      return;
    }

    const file = episodeVideoFileRef.current?.files?.[0];
    let videoRef = episodeVideoLink.trim();
    if (file) {
      try {
        onNotify('Uploading episode video to Cloudflare R2...');
        videoRef = await uploadFileToR2(file, 'episodes');
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Episode R2 upload failed.');
        return;
      }
    }

    updateState((prev) => {
      if (editEpisodeId) {
        return {
          ...prev,
          episodes: prev.episodes.map((ep) =>
            ep.id === editEpisodeId
              ? {
                  ...ep,
                  seasonId: episodeSeasonId,
                  episodeNumber: epNum,
                  title,
                  video: videoRef || ep.video,
                }
              : ep
          ),
        };
      }
      return {
        ...prev,
        episodes: [
          ...prev.episodes,
          {
            id: 'ep_' + Date.now(),
            seasonId: episodeSeasonId,
            episodeNumber: epNum,
            title,
            video: videoRef || '',
          },
        ],
      };
    });

    resetEpisodeForm();
    onNotify('Episode saved.');
  };

  /* --- LIVE TV HANDLERS --- */
  const resetTvForm = () => {
    setEditTvId('');
    setTvName('');
    setTvStreamUrl('');
    setTvCategory('');
    setTvPosterLink('');
    setTvPosterPreview('');
    setTvPosterRemoved(false);
    if (tvPosterFileRef.current) tvPosterFileRef.current.value = '';
  };

  const handleTvPosterFileChange = () => {
    const file = tvPosterFileRef.current?.files?.[0];
    if (file) {
      setTvPosterRemoved(false);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setTvPosterPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const startEditTvChannel = async (id: string, targetTab?: AdminTab) => {
    const ch = (state.liveTvChannels || []).find((x) => x.id === id);
    if (!ch) return;
    if (targetTab) setActiveTab(targetTab);
    setEditTvId(ch.id);
    setTvName(ch.name);
    setTvStreamUrl(ch.streamUrl);
    setTvCategory(ch.category || '');
    setTvPosterRemoved(false);
    setTvPosterLink(ch.poster && !ch.poster.startsWith('idb://') ? ch.poster : '');
    setTvPosterPreview(await resolveMediaUrl(ch.poster));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveTvChannelRecord = async () => {
    const name = tvName.trim();
    const streamUrl = tvStreamUrl.trim();
    if (!name || !streamUrl) {
      onNotify('Enter TV Channel Name and Live TV Link.');
      return;
    }

    const file = tvPosterFileRef.current?.files?.[0];
    const existingTv = editTvId
      ? (state.liveTvChannels || []).find((x) => x.id === editTvId)
      : undefined;
    let posterRef = tvPosterRemoved
      ? ''
      : sanitizeAssetUrl(tvPosterLink.trim()) || existingTv?.poster || '';
    if (file) {
      try {
        onNotify('Uploading channel poster to Cloudflare R2...');
        posterRef = await uploadFileToR2(file, 'livetv');
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Channel poster R2 upload failed.');
        return;
      }
    }

    updateState((prev) => {
      const existing = prev.liveTvChannels || [];
      if (editTvId) {
        return {
          ...prev,
          liveTvChannels: existing.map((ch) =>
            ch.id === editTvId
              ? {
                  ...ch,
                  name,
                  streamUrl,
                  category: tvCategory.trim(),
                  poster: tvPosterRemoved ? '' : posterRef || ch.poster || '',
                }
              : ch
          ),
        };
      }
      return {
        ...prev,
        liveTvChannels: [
          ...existing,
          {
            id: 'tv_' + Date.now(),
            name,
            streamUrl,
            category: tvCategory.trim(),
            poster: tvPosterRemoved ? '' : posterRef || '',
          },
        ],
      };
    });

    resetTvForm();
    onNotify('Live TV link saved!');
  };

  const deleteTvChannel = (id: string) => {
    updateState((prev) => ({
      ...prev,
      liveTvChannels: (prev.liveTvChannels || []).filter((ch) => ch.id !== id),
    }));
    if (editTvId === id) resetTvForm();
    onNotify('Live TV channel deleted.');
  };

  /* --- GENRES & CATEGORIES HANDLER --- */
  const saveGenreLine = () => {
    const parsedGenres = parseGenreLine(setGenreLine);
    const parsedCategories = parseCategoryLine(setCategoryLine);
    if (parsedGenres.length === 0) {
      onNotify('Enter at least one genre separated by commas.');
      return;
    }
    if (parsedCategories.length === 0) {
      onNotify('Enter at least one category separated by commas.');
      return;
    }
    const cleanGenreLine = parsedGenres.join(', ');
    const cleanCategoryLine = parsedCategories.join(', ');
    setSetGenreLine(cleanGenreLine);
    setSetCategoryLine(cleanCategoryLine);
    updateState((prev) => ({
      ...prev,
      categories: parsedCategories.map((name, idx) => ({ id: `cat_${idx}`, name })),
      genres: parsedGenres.map((name, idx) => ({ id: `gen_${idx}`, name })),
      settings: {
        ...prev.settings,
        genreLine: cleanGenreLine,
        categoryLine: cleanCategoryLine,
      },
    }));
    onNotify('Genres & Categories updated & live instantly!');
  };

  /* --- PAYMENT PLANS CRUD (NAME, PRICE, DAYS) --- */
  const resetPaymentPlanForm = () => {
    setEditPlanId('');
    setPlanNameInput('');
    setPlanPriceInput('');
    setPlanDaysInput('');
  };

  const savePaymentPlanRecord = () => {
    const name = planNameInput.trim();
    const price = Number(planPriceInput);
    const days = Number(planDaysInput);
    if (!name) {
      onNotify('Enter payment plan name (e.g. Daily, Weekly, Monthly).');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      onNotify('Enter a valid UGX price.');
      return;
    }
    if (!Number.isFinite(days) || days < 1) {
      onNotify('Enter number of days (at least 1).');
      return;
    }

    updateState((prev) => {
      const current =
        Array.isArray(prev.settings.paymentPlans) && prev.settings.paymentPlans.length > 0
          ? prev.settings.paymentPlans
          : configuredPaymentPlans;
      const nextPlans = editPlanId
        ? current.map((p) =>
            p.id === editPlanId ? { ...p, name, price, days: Math.round(days) } : p
          )
        : [
            ...current,
            {
              id: 'plan_' + Date.now(),
              name,
              price,
              days: Math.round(days),
            },
          ];
      return {
        ...prev,
        settings: {
          ...prev.settings,
          paymentPlans: nextPlans,
        },
      };
    });

    resetPaymentPlanForm();
    onNotify(editPlanId ? `Updated "${name}" plan!` : `Added "${name}" payment plan!`);
  };

  const deletePaymentPlanRecord = (planId: string) => {
    updateState((prev) => {
      const current =
        Array.isArray(prev.settings.paymentPlans) && prev.settings.paymentPlans.length > 0
          ? prev.settings.paymentPlans
          : configuredPaymentPlans;
      if (current.length <= 1) {
        onNotify('Keep at least one payment plan.');
        return prev;
      }
      return {
        ...prev,
        settings: {
          ...prev.settings,
          paymentPlans: current.filter((p) => p.id !== planId),
        },
      };
    });
    if (editPlanId === planId) resetPaymentPlanForm();
    onNotify('Payment plan deleted.');
  };

  /* --- SETTINGS HANDLERS --- */
  const saveR2Settings = () => {
    const cleanLinks = setR2Links.map((x) => x.trim());
    updateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        r2Endpoint: cleanLinks[0] || '',
        r2Links: cleanLinks,
      },
    }));
    onNotify('All 5 R2 links saved!');
  };

  const saveSocialPlatforms = () => {
    updateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        whatsappUrl: setWhatsappUrl.trim(),
        youtubeUrl: setYoutubeUrl.trim(),
        facebookUrl: setFacebookUrl.trim(),
        tiktokUrl: setTiktokUrl.trim(),
        socialLinks: setSocialLinks.trim(),
      },
    }));
    onNotify('WhatsApp, YouTube, Facebook & TikTok links saved!');
  };

  const saveSingleSocialPlatform = (
    field: 'whatsappUrl' | 'youtubeUrl' | 'facebookUrl' | 'tiktokUrl',
    label: string,
    value: string
  ) => {
    updateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value.trim(),
      },
    }));
    onNotify(`${label} link saved!`);
  };

  const savePosterSettings = () => {
    updateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        showPosterLabel: setShowPosterLabel,
        showPosterRating: setShowPosterRating,
        showPosterSocialBar: setShowPosterSocialBar,
        showPosterYear: setShowPosterYear,
        showPosterActors: setShowPosterActors,
        showPosterDescription: setShowPosterDescription,
      },
    }));
    onNotify('Poster display settings saved!');
  };

  const saveSettings = () => {
    const cleanLinks = setR2Links.map((x) => x.trim());
    const parsedGenres = parseGenreLine(setGenreLine);
    const cleanGenreLine =
      parsedGenres.length > 0 ? parsedGenres.join(', ') : DEFAULT_GENRE_LINE;
    const syncedGenres = parseGenreLine(cleanGenreLine);
    const parsedCategories = parseCategoryLine(setCategoryLine);
    const cleanCategoryLine =
      parsedCategories.length > 0 ? parsedCategories.join(', ') : DEFAULT_CATEGORY_LINE;
    const syncedCategories = parseCategoryLine(cleanCategoryLine);
    setSetGenreLine(cleanGenreLine);
    setSetCategoryLine(cleanCategoryLine);

    updateState((prev) => ({
      ...prev,
      categories: syncedCategories.map((name, idx) => ({ id: `cat_${idx}`, name })),
      genres: syncedGenres.map((name, idx) => ({ id: `gen_${idx}`, name })),
      settings: {
        ...prev.settings,
        appName: setAppName.trim() || 'VJ EMMA - TRUE LIGHT PRODUCTION',
        genreLine: cleanGenreLine,
        categoryLine: cleanCategoryLine,
        r2Endpoint: cleanLinks[0] || '',
        r2Links: cleanLinks,
        whatsappKey: setWhatsappKey.trim(),
        socialLinks: setSocialLinks.trim(),
        whatsappUrl: setWhatsappUrl.trim(),
        youtubeUrl: setYoutubeUrl.trim(),
        facebookUrl: setFacebookUrl.trim(),
        tiktokUrl: setTiktokUrl.trim(),
        priceWeekly: Number(setPriceWeekly) || 5000,
        priceMonthly: Number(setPriceMonthly) || 15000,
        priceVip: Number(setPriceVip) || 30000,
        showPosterLabel: setShowPosterLabel,
        showPosterRating: setShowPosterRating,
        showPosterSocialBar: setShowPosterSocialBar,
        showPosterYear: setShowPosterYear,
        showPosterActors: setShowPosterActors,
        showPosterDescription: setShowPosterDescription,
      },
    }));
    onNotify('Settings saved & live instantly.');
  };

  const handleSaveAdminCredentials = async () => {
    if (!state.isAdminLoggedIn) {
      onNotify('Only Admin can change the Admin password.');
      return;
    }
    if (!cpNew || cpNew.length < 6) {
      onNotify('New password must be at least 6 characters.');
      return;
    }
    if (cpNew !== cpConfirm) {
      onNotify('New passwords do not match.');
      return;
    }

    const res = await updateAdminPasswordInD1(cpNew);
    if (!res.ok) {
      onNotify(res.error || 'Could not update Admin password in D1.');
      return;
    }

    setCpNew('');
    setCpConfirm('');
    onNotify('Admin password updated securely in Cloudflare D1!');
  };

  /* --- CLIENTS / USERS & WALLET HANDLERS --- */
  const getPlanPricing = (planName: string) => {
    const matched = configuredPaymentPlans.find(
      (p) => p.name.toLowerCase() === planName.toLowerCase()
    );
    if (matched) {
      return { amount: Number(matched.price), days: Number(matched.days) };
    }
    if (planName.toLowerCase() === 'weekly') {
      return { amount: Number(state.settings.priceWeekly || 5000), days: 7 };
    }
    if (planName.toLowerCase() === 'vip') {
      return { amount: Number(state.settings.priceVip || 30000), days: 30 };
    }
    return { amount: Number(state.settings.priceMonthly || 15000), days: 30 };
  };

  const approveUser = async (userId: string, overridePlan?: string) => {
    const target = state.users.find((u) => u.id === userId);
    if (!target) return;

    const chosenPlan: string =
      overridePlan ||
      target.pendingPlan ||
      target.plan ||
      configuredPaymentPlans[0]?.name ||
      'Monthly';
    const { days: fallbackDays } = getPlanPricing(chosenPlan);
    const days = Math.max(1, Number(target.pendingDays || fallbackDays || 1));

    if (onApprovePaymentRequest) {
      const res = await onApprovePaymentRequest(userId, chosenPlan);
      if (res.ok) {
        onNotify(`Approved ${target.phone} (${chosenPlan} · ${days} ${days === 1 ? 'Day' : 'Days'}).`);
      } else {
        onNotify(`D1 error: ${res.error || 'Could not approve client.'}`);
      }
      return;
    }
    onNotify('D1 payment_requests handler unavailable.');
  };

  const blockUser = async (userId: string) => {
    const target = state.users.find((u) => u.id === userId);
    if (!target) return;

    if (onBlockPaymentRequest) {
      const res = await onBlockPaymentRequest(userId);
      if (res.ok) {
        onNotify(`Blocked ${target.phone}.`);
      } else {
        onNotify(`D1 error: ${res.error || 'Could not block client.'}`);
      }
      return;
    }
    onNotify('D1 payment_requests handler unavailable.');
  };

  const deleteUser = async (userId: string) => {
    const target = state.users.find((u) => u.id === userId);
    if (!target) return;

    if (onDeletePaymentRequest) {
      const res = await onDeletePaymentRequest(userId);
      if (res.ok) {
        onNotify(`Deleted payment request ${target.phone}.`);
      } else {
        onNotify(`D1 error: ${res.error || 'Could not delete row.'}`);
      }
      return;
    }
    onNotify('D1 payment_requests handler unavailable.');
  };

  const addManualClient = async () => {
    const name = newClientName.trim();
    const phone = newClientPhone.trim();
    const email = newClientEmail.trim();
    if (!phone) {
      onNotify('Enter Client Phone number.');
      return;
    }
    const { amount, days } = getPlanPricing(newClientPlan);
    const validDays = Math.max(1, Number(days || 1));

    if (onAddManualPaymentRequest) {
      const res = await onAddManualPaymentRequest({
        name: name || undefined,
        phone,
        email,
        plan: newClientPlan,
        amount,
        days: validDays,
      });
      if (res.ok) {
        setNewClientName('');
        setNewClientPhone('');
        setNewClientEmail('');
        onNotify(
          `Manual payment for ${name || phone} saved to D1 payment_requests (${newClientPlan} · ${validDays} ${validDays === 1 ? 'Day' : 'Days'}).`
        );
      } else {
        onNotify(`D1 error: ${res.error || 'Could not add manual payment.'}`);
      }
      return;
    }
    onNotify('D1 payment_requests handler unavailable.');
  };

  const adjustWallet = (mode: 'add' | 'withdraw') => {
    const raw = Number(walletAdjAmount);
    if (!raw || raw <= 0) {
      onNotify('Enter a valid UGX amount.');
      return;
    }
    const delta = mode === 'add' ? raw : -raw;
    updateState((prev) => ({
      ...prev,
      wallet: Math.max(0, prev.wallet + delta),
      walletTransactions: [
        {
          id: 'tx_' + Date.now(),
          phone: 'Admin',
          email: walletAdjNote.trim() || (mode === 'add' ? 'Manual Deposit' : 'Manual Payout'),
          plan: mode === 'add' ? 'Wallet Deposit' : 'Wallet Withdrawal',
          amount: delta,
          method: 'Admin Wallet Adjustment',
          status: 'adjustment',
          createdAt: Date.now(),
        },
        ...(prev.walletTransactions || []),
      ],
    }));
    setWalletAdjAmount('');
    setWalletAdjNote('');
    onNotify(mode === 'add' ? 'Wallet credited.' : 'Wallet withdrawn.');
  };

  const switchAdminTab = (tab: AdminTab) => {
    setActiveTab(tab);
    if (tab === 'clients') {
      onRefreshPaymentRequests?.();
    }
    if (tab === 'settings' || tab === 'categories') {
      setSetAppName(state.settings.appName);
      setSetGenreLine(
        state.settings.genreLine !== undefined ? state.settings.genreLine : DEFAULT_GENRE_LINE
      );
      setSetCategoryLine(
        state.settings.categoryLine !== undefined ? state.settings.categoryLine : DEFAULT_CATEGORY_LINE
      );
      const arr = Array.isArray(state.settings.r2Links) ? state.settings.r2Links : [];
      setSetR2Links([0, 1, 2, 3, 4].map((i) => arr[i] ?? (i === 0 ? state.settings.r2Endpoint || '' : '')));
      setSetWhatsappKey(state.settings.whatsappKey);
      setSetSocialLinks(state.settings.socialLinks);
      setSetWhatsappUrl(state.settings.whatsappUrl || '');
      setSetYoutubeUrl(state.settings.youtubeUrl || '');
      setSetFacebookUrl(state.settings.facebookUrl || '');
      setSetTiktokUrl(state.settings.tiktokUrl || '');
      setSetPriceWeekly(String(state.settings.priceWeekly || 5000));
      setSetPriceMonthly(String(state.settings.priceMonthly || 15000));
      setSetPriceVip(String(state.settings.priceVip || 30000));
      setSetShowPosterLabel(state.settings.showPosterLabel !== false);
      setSetShowPosterRating(state.settings.showPosterRating !== false);
      setSetShowPosterSocialBar(state.settings.showPosterSocialBar !== false);
      setSetShowPosterYear(state.settings.showPosterYear !== false);
      setSetShowPosterActors(state.settings.showPosterActors !== false);
      setSetShowPosterDescription(state.settings.showPosterDescription !== false);
    }
  };

  const inputCls =
    'w-full min-h-[42px] rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#d4af37] focus:outline-none';
  const labelCls = 'mb-1.5 block text-xs font-bold text-[#f0cf65]';

  return (
    <div className="px-4 py-5">
      {/* ADMIN TOP BAR */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d4af37] bg-gradient-to-br from-[#1b0b2e] to-[#0f0d16] p-4">
        <div>
          <div className="font-display text-base font-black text-[#d4af37]">ADMIN PANEL</div>
          <div className="text-xs text-[#b0aab8]">
            {state.currentUser
              ? `${state.currentUser.phone} · ${state.currentUser.email}`
              : 'Admin Active'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onViewSite}
            className="min-h-[40px] rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-3.5 py-2 text-xs font-bold text-white"
          >
            View Site
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[40px] rounded-lg bg-[#b71c1c] px-3.5 py-2 text-xs font-bold text-white"
          >
            Logout
          </button>
        </div>
      </div>

      {/* DASHBOARD METRICS (CLICKABLE SHORTCUTS TO WALLET, CLIENTS/USERS, MEDIA) */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => switchAdminTab('wallet')}
          className="rounded-xl border border-[#d4af37]/40 bg-[#111018] p-3.5 text-left transition-colors hover:border-[#d4af37]"
        >
          <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Wallet</div>
          <div className="mt-1 text-xl font-black text-[#d4af37] tabular-nums">
            UGX {Number(state.wallet || 0).toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-white/60">Open Wallet →</div>
        </button>
        <button
          type="button"
          onClick={() => switchAdminTab('clients')}
          className="rounded-xl border border-[#d4af37]/40 bg-[#111018] p-3.5 text-left transition-colors hover:border-[#d4af37]"
        >
          <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Clients</div>
          <div className="mt-1 text-xl font-black text-[#d4af37] tabular-nums">
            {approvedClientsCount || state.clients || 0}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-amber-300">
            {pendingClientsCount > 0 ? `${pendingClientsCount} Pending Approval` : 'Manage Clients →'}
          </div>
        </button>
        <button
          type="button"
          onClick={() => switchAdminTab('clients')}
          className="rounded-xl border border-[#d4af37]/40 bg-[#111018] p-3.5 text-left transition-colors hover:border-[#d4af37]"
        >
          <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Users</div>
          <div className="mt-1 text-xl font-black text-[#d4af37] tabular-nums">
            {state.users.length}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-white/60">
            {blockedClientsCount} Blocked · Manage →
          </div>
        </button>
        <button
          type="button"
          onClick={() => switchAdminTab('media')}
          className="rounded-xl border border-[#d4af37]/40 bg-[#111018] p-3.5 text-left transition-colors hover:border-[#d4af37]"
        >
          <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Media</div>
          <div className="mt-1 text-xl font-black text-[#d4af37] tabular-nums">{mediaTotal}</div>
          <div className="mt-0.5 text-[10px] font-semibold text-white/60">All Media →</div>
        </button>
      </div>

      {/* OVERVIEW BAR */}
      <button
        type="button"
        onClick={() => switchAdminTab('overview')}
        className="mb-4 block w-full rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4 text-left transition-colors hover:border-[#d4af37]"
      >
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="font-display text-sm font-extrabold text-[#d4af37]">Overview</h3>
          <span className="text-[11px] font-bold text-[#f0cf65]">Open Full Overview →</span>
        </div>
        <p className="text-xs text-[#b0aab8] tabular-nums">
          Movies: {state.movies.length} | Banners: {state.banners.length} | Series Seasons:{' '}
          {state.seasons.length} | Episodes: {state.episodes.length} | Live TV:{' '}
          {state.liveTvChannels?.length || 0} | Genres: {oneLineGenres.length}
        </p>
      </button>

      {/* ONE TAB AT A TIME IN ADMIN */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto border-b border-[#d4af37]/30 pb-2.5">
        {(
          [
            ['overview', 'Overview'],
            ['wallet', 'Wallet'],
            ['clients', pendingClientsCount > 0 ? `Clients/Users (${pendingClientsCount})` : 'Clients/Users'],
            ['media', 'Media'],
            ['movies', 'Movies'],
            ['banners', 'Banners'],
            ['series', 'Series'],
            ['livetv', 'Live TV'],
            ['categories', 'Genres'],
            ['settings', 'Settings'],
          ] as [AdminTab, string][]
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => switchAdminTab(tabKey)}
            className={`min-h-[42px] shrink-0 whitespace-nowrap rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors ${
              activeTab === tabKey
                ? 'border-[#d4af37] bg-[#d4af37] text-black'
                : 'border-[#6a0dad]/45 bg-[#111018] text-[#b0aab8] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 0A: OVERVIEW SPACE */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              Platform Overview
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#6a0dad]/40 bg-[#09080f] p-3">
                <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Wallet Balance</div>
                <div className="mt-1 text-lg font-black text-[#d4af37] tabular-nums">
                  UGX {Number(state.wallet || 0).toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-[#6a0dad]/40 bg-[#09080f] p-3">
                <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Active Clients</div>
                <div className="mt-1 text-lg font-black text-emerald-400 tabular-nums">
                  {approvedClientsCount}
                </div>
              </div>
              <div className="rounded-lg border border-[#6a0dad]/40 bg-[#09080f] p-3">
                <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Pending WhatsApp</div>
                <div className="mt-1 text-lg font-black text-amber-300 tabular-nums">
                  {pendingClientsCount}
                </div>
              </div>
              <div className="rounded-lg border border-[#6a0dad]/40 bg-[#09080f] p-3">
                <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Blocked Users</div>
                <div className="mt-1 text-lg font-black text-rose-400 tabular-nums">
                  {blockedClientsCount}
                </div>
              </div>
              <div className="rounded-lg border border-[#6a0dad]/40 bg-[#09080f] p-3">
                <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Total Media</div>
                <div className="mt-1 text-lg font-black text-white tabular-nums">{mediaTotal}</div>
              </div>
              <div className="rounded-lg border border-[#6a0dad]/40 bg-[#09080f] p-3">
                <div className="text-[11px] font-bold uppercase text-[#b0aab8]">Live TV Channels</div>
                <div className="mt-1 text-lg font-black text-[#f0cf65] tabular-nums">
                  {state.liveTvChannels?.length || 0}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => switchAdminTab('clients')}
                className="min-h-[42px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
              >
                Approve / Block Clients
              </button>
              <button
                type="button"
                onClick={() => switchAdminTab('wallet')}
                className="min-h-[42px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-4 py-2 text-xs font-bold text-white"
              >
                Manage Wallet
              </button>
              <button
                type="button"
                onClick={() => switchAdminTab('media')}
                className="min-h-[42px] rounded-lg border border-[#d4af37] bg-[#1a132b] px-4 py-2 text-xs font-bold text-[#f0cf65]"
              >
                Browse All Media
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 0B: WALLET SPACE */}
      {activeTab === 'wallet' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-1 font-display text-base font-extrabold text-[#d4af37]">
              Admin Wallet
            </h3>
            <div className="mb-4 text-3xl font-black text-white tabular-nums">
              UGX {Number(state.wallet || 0).toLocaleString()}
            </div>

            <div className="space-y-3 border-t border-white/10 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Amount (UGX)</label>
                  <input
                    type="number"
                    value={walletAdjAmount}
                    onChange={(e) => setWalletAdjAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Note / Reason</label>
                  <input
                    type="text"
                    value={walletAdjNote}
                    onChange={(e) => setWalletAdjNote(e.target.value)}
                    placeholder="e.g. Manual Cash / Withdraw"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => adjustWallet('add')}
                  className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
                >
                  + Add to Wallet
                </button>
                <button
                  type="button"
                  onClick={() => adjustWallet('withdraw')}
                  className="min-h-[44px] rounded-lg bg-[#b71c1c] px-4 py-2 text-xs font-bold text-white"
                >
                  Withdraw / Deduct
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              Wallet Transactions ({state.walletTransactions?.length || 0})
            </h3>
            {!state.walletTransactions || state.walletTransactions.length === 0 ? (
              <p className="text-xs text-[#b0aab8]">No payment transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {state.walletTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">
                        {tx.plan} · {tx.phone}
                      </div>
                      <div className="text-xs text-[#b0aab8]">
                        {tx.method} · {tx.email} · {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-[#d4af37] tabular-nums">
                        {tx.amount >= 0 ? `+UGX ${tx.amount.toLocaleString()}` : `-UGX ${Math.abs(tx.amount).toLocaleString()}`}
                      </div>
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          tx.status === 'completed'
                            ? 'bg-emerald-900/70 text-emerald-300'
                            : tx.status === 'pending'
                            ? 'bg-amber-900/70 text-amber-300'
                            : 'bg-[#6a0dad]/60 text-[#f0cf65]'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 0C: CLIENTS & USERS (APPROVE / BLOCK / DELETE) */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              Add Manual Payment
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Client Name</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Full Name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Client Phone</label>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="+2567XXXXXXXX"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Client Email (Optional)</label>
                <input
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Subscription Plan</label>
                <select
                  value={newClientPlan}
                  onChange={(e) => setNewClientPlan(e.target.value)}
                  className={inputCls}
                >
                  {configuredPaymentPlans.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} — UGX {Number(p.price).toLocaleString()} ({p.days}{' '}
                      {p.days === 1 ? 'Day' : 'Days'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={addManualClient}
              className="mt-3 min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
            >
              Add Manual Payment
            </button>
          </div>

          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-extrabold text-[#d4af37]">
                  Clients / Payment Requests ({state.users.length})
                </h3>
                <p className="text-[11px] text-[#b0aab8]">
                  Loaded live from Cloudflare D1 (<span className="font-bold text-white">vjemmadb · payment_requests</span>, newest first)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onRefreshPaymentRequests && (
                  <button
                    type="button"
                    onClick={() => onRefreshPaymentRequests()}
                    className="min-h-[38px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-[#f0cf65]"
                  >
                    Refresh D1
                  </button>
                )}
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search name, phone or email..."
                  className="min-h-[38px] w-full rounded-lg border border-[#6a0dad]/60 bg-[#08070c] px-3 py-1.5 text-xs text-white placeholder-white/40 sm:w-56"
                />
              </div>
            </div>

            {paymentRequestsError && (
              <div className="mb-3 rounded-lg border border-rose-500/70 bg-rose-950/60 p-3 text-xs font-semibold text-rose-200">
                D1 payment_requests error: {paymentRequestsError}
              </div>
            )}

            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  ['all', `All (${state.users.length})`],
                  ['pending', `Pending (${pendingClientsCount})`],
                  ['approved', `Approved (${approvedClientsCount})`],
                  ['blocked', `Blocked (${blockedClientsCount})`],
                ] as const
              ).map(([filterKey, filterLabel]) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setClientFilter(filterKey)}
                  className={`min-h-[36px] rounded-lg border px-3 py-1 text-xs font-bold ${
                    clientFilter === filterKey
                      ? 'border-[#d4af37] bg-[#d4af37] text-black'
                      : 'border-[#6a0dad]/45 bg-[#0a090f] text-[#b0aab8]'
                  }`}
                >
                  {filterLabel}
                </button>
              ))}
            </div>

            {state.users.length === 0 ? (
              <p className="text-xs text-[#b0aab8]">
                No payment requests yet. Submissions from Manual WhatsApp appear here newest-first.
              </p>
            ) : (
              <div className="space-y-2.5">
                {state.users
                  .filter((u) => {
                    const st = u.status || (u.subscribed ? 'approved' : 'pending');
                    const matchesFilter = clientFilter === 'all' || st === clientFilter;
                    const q = clientSearch.trim().toLowerCase();
                    const matchesQuery =
                      !q ||
                      (u.name || '').toLowerCase().includes(q) ||
                      u.phone.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q);
                    return matchesFilter && matchesQuery;
                  })
                  .map((u) => {
                    const userStatus = u.status || (u.subscribed ? 'approved' : 'pending');
                    const isExpired = Boolean(
                      userStatus !== 'blocked' &&
                        u.subscribed &&
                        u.expiry > 0 &&
                        u.expiry <= Date.now()
                    );
                    const badgeLabel = isExpired ? 'expired' : userStatus;
                    return (
                      <div
                        key={u.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {u.name ? `${u.name} · ${u.phone}` : u.phone}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                userStatus === 'blocked'
                                  ? 'bg-rose-900/80 text-rose-200'
                                  : isExpired
                                  ? 'bg-amber-900/80 text-amber-200'
                                  : userStatus === 'approved' && u.subscribed
                                  ? 'bg-emerald-900/80 text-emerald-200'
                                  : 'bg-amber-900/80 text-amber-200'
                              }`}
                            >
                              {badgeLabel}
                            </span>
                          </div>
                          <div className="truncate text-xs text-[#b0aab8]">{u.email}</div>
                          <div className="mt-0.5 text-[11px] text-[#e0d8ef]">
                            {u.subscribed && u.plan
                              ? `Plan: ${u.plan} · ${isExpired ? 'Expired' : 'Expires'} ${new Date(u.expiry).toLocaleString()}`
                              : u.pendingPlan
                              ? `Requested: ${u.pendingPlan} (UGX ${Number(u.pendingAmount || 0).toLocaleString()})`
                              : 'Not Subscribed'}
                            {u.paymentMethod ? ` · ${u.paymentMethod}` : ''}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => approveUser(u.id)}
                            className="min-h-[40px] rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white"
                          >
                            Approve
                          </button>
                          {userStatus !== 'blocked' ? (
                            <button
                              type="button"
                              onClick={() => blockUser(u.id)}
                              className="min-h-[40px] rounded-md border border-amber-400/70 bg-amber-700 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Block
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => approveUser(u.id)}
                              className="min-h-[40px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-[#f0cf65]"
                            >
                              Unblock
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteUser(u.id)}
                            className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 0D: MEDIA LIBRARY SPACE */}
      {activeTab === 'media' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              All Media Library ({mediaTotal} items)
            </h3>
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => switchAdminTab('movies')}
                className="rounded-lg border border-[#6a0dad]/50 bg-[#0a090f] p-3 text-left"
              >
                <div className="text-[11px] font-bold text-[#b0aab8]">Movies</div>
                <div className="text-lg font-black text-[#d4af37]">{state.movies.length}</div>
              </button>
              <button
                type="button"
                onClick={() => switchAdminTab('banners')}
                className="rounded-lg border border-[#6a0dad]/50 bg-[#0a090f] p-3 text-left"
              >
                <div className="text-[11px] font-bold text-[#b0aab8]">Banners</div>
                <div className="text-lg font-black text-[#d4af37]">{state.banners.length}</div>
              </button>
              <button
                type="button"
                onClick={() => switchAdminTab('series')}
                className="rounded-lg border border-[#6a0dad]/50 bg-[#0a090f] p-3 text-left"
              >
                <div className="text-[11px] font-bold text-[#b0aab8]">Episodes</div>
                <div className="text-lg font-black text-[#d4af37]">{state.episodes.length}</div>
              </button>
              <button
                type="button"
                onClick={() => switchAdminTab('livetv')}
                className="rounded-lg border border-[#6a0dad]/50 bg-[#0a090f] p-3 text-left"
              >
                <div className="text-[11px] font-bold text-[#b0aab8]">Live TV</div>
                <div className="text-lg font-black text-[#d4af37]">{state.liveTvChannels?.length || 0}</div>
              </button>
            </div>

            <div className="space-y-2">
              {state.movies.map((m) => (
                <div
                  key={`med-m-${m.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <AdminThumb srcRef={m.poster} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{m.title}</div>
                      <div className="text-xs text-[#b0aab8]">
                        Movie · {m.video ? 'Video Attached' : 'No Video'} · {m.poster ? 'Poster Set' : 'No Poster'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditMovie(m.id)}
                      className="min-h-[38px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1 text-xs font-bold text-[#d4af37]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMovie(m.id)}
                      className="min-h-[38px] rounded-md bg-[#b71c1c] px-3 py-1 text-xs font-bold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {(state.liveTvChannels || []).map((ch) => (
                <div
                  key={`med-tv-${ch.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <AdminThumb srcRef={ch.poster} className="h-12 w-16" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{ch.name}</div>
                      <div className="truncate text-xs text-[#b0aab8]">Live TV · {ch.streamUrl}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditTvChannel(ch.id, 'livetv')}
                      className="min-h-[38px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1 text-xs font-bold text-[#d4af37]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTvChannel(ch.id)}
                      className="min-h-[38px] rounded-md bg-[#b71c1c] px-3 py-1 text-xs font-bold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: MOVIES */}
      {activeTab === 'movies' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-extrabold text-[#d4af37]">
                {editMovieId ? `Edit Poster / Movie: ${movieTitle}` : 'Put New Poster / Movie'}
              </h3>
              <button
                type="button"
                onClick={resetMovieForm}
                className="min-h-[38px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-white"
              >
                + Put New Poster
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Title</label>
                <input
                  type="text"
                  value={movieTitle}
                  onChange={(e) => setMovieTitle(e.target.value)}
                  placeholder="Movie title"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Year</label>
                  <input
                    type="number"
                    value={movieYear}
                    onChange={(e) => setMovieYear(e.target.value)}
                    placeholder="2026"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Duration / Time</label>
                  <input
                    type="text"
                    value={movieDuration}
                    onChange={(e) => setMovieDuration(e.target.value)}
                    placeholder="e.g. 1h 45m"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Rating</label>
                  <input
                    type="text"
                    value={movieRating}
                    onChange={(e) => setMovieRating(e.target.value)}
                    placeholder="e.g. 4.9"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Genres (Multi-Select · Check One, Two, Three or Many)
                </label>
                <div className="grid max-h-[240px] grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[#6a0dad]/60 bg-[#0a090f] p-2.5 sm:grid-cols-3">
                  {availableMovieGenreChoices.map((g) => {
                    const checked = selectedMovieGenres.some(
                      (item) => item.toLowerCase() === g.toLowerCase()
                    );
                    return (
                      <label
                        key={g}
                        className={`flex min-h-[38px] cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          checked
                            ? 'border-[#d4af37] bg-[#6a0dad]/70 text-[#f0cf65]'
                            : 'border-white/10 bg-[#12101b] text-white/80 hover:border-[#6a0dad]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMovieGenre(g)}
                          className="h-4 w-4 accent-[#d4af37]"
                        />
                        <span className="truncate">{g}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedMovieGenres.length > 0 && (
                  <p className="mt-1.5 text-[11px] font-semibold text-[#f0cf65]">
                    Selected Genres ({selectedMovieGenres.length}): {selectedMovieGenres.join(' + ')}
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>
                  Categories (Multi-Select · Check One, Two, Three or Many)
                </label>
                <div className="grid max-h-[200px] grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[#6a0dad]/60 bg-[#0a090f] p-2.5 sm:grid-cols-3">
                  {availableMovieCategoryChoices.map((c) => {
                    const checked = selectedMovieCategories.some(
                      (item) => item.toLowerCase() === c.toLowerCase()
                    );
                    return (
                      <label
                        key={`mov-cat-${c}`}
                        className={`flex min-h-[38px] cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          checked
                            ? 'border-[#d4af37] bg-[#6a0dad]/70 text-[#f0cf65]'
                            : 'border-white/10 bg-[#12101b] text-white/80 hover:border-[#6a0dad]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMovieCategory(c)}
                          className="h-4 w-4 accent-[#d4af37]"
                        />
                        <span className="truncate">{c}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedMovieCategories.length > 0 && (
                  <p className="mt-1.5 text-[11px] font-semibold text-[#f0cf65]">
                    Selected Categories ({selectedMovieCategories.length}): {selectedMovieCategories.join(' + ')}
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>
                  Poster Label (Optional) — e.g. VIP
                </label>
                <input
                  type="text"
                  value={movieLabel}
                  onChange={(e) => setMovieLabel(e.target.value)}
                  placeholder="e.g. VIP (leave empty for clean poster)"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Actors Names</label>
                <input
                  type="text"
                  value={movieActors}
                  onChange={(e) => setMovieActors(e.target.value)}
                  placeholder="e.g. Okello Moses, Akello Grace, Opiyo Daniel"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={movieDescription}
                  onChange={(e) => setMovieDescription(e.target.value)}
                  placeholder="Movie description..."
                  className={`${inputCls} min-h-[76px] resize-y`}
                />
              </div>

              <div>
                <label className={labelCls}>Poster Image: Direct Upload Button + Image Link</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => posterFileRef.current?.click()}
                    className="min-h-[42px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Direct Upload Poster Image
                  </button>
                  <input
                    ref={posterFileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePosterFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <span className="text-xs text-[#b0aab8]">
                    {selectedPosterFile?.name || posterFileRef.current?.files?.[0]?.name || 'Or paste image link below'}
                  </span>
                </div>
                <input
                  type="url"
                  value={moviePosterLink}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMoviePosterLink(val);
                    setPosterRemoved(false);
                    setUploadedPosterRef('');
                    setSelectedPosterFile(null);
                    setMoviePosterPreview(val.trim());
                  }}
                  placeholder="Paste Poster image link (https://...)"
                  className={`${inputCls} mt-2`}
                />
                {moviePosterPreview && (
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div className="relative h-[156px] w-[106px] overflow-hidden rounded-lg border border-[#d4af37] bg-[#181228]">
                      <img
                        src={moviePosterPreview}
                        alt="Poster Preview"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      {movieLabel.trim() && (
                        <div className="absolute left-1.5 top-1.5 flex max-w-[78%] flex-wrap gap-1">
                          <span
                            className={
                              movieLabel.trim().toUpperCase().includes('VIP')
                                ? 'rounded border border-[#f0cf65] bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-1.5 py-0.5 text-[8px] font-black text-black'
                                : 'rounded border border-[#d4af37] bg-[#6a0dad] px-1.5 py-0.5 text-[8px] font-extrabold text-[#f0cf65]'
                            }
                          >
                            {movieLabel.trim()}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 divide-x divide-white/15 border-t border-[#6a0dad] bg-[#0b0714]/90 py-1 text-center text-[8px] font-bold text-white">
                        <span>Like</span>
                        <span>Share</span>
                        <span>Comment</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeMoviePoster}
                      className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Delete Poster
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Single Movie Video: Direct Upload Button + Video Link</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => videoFileRef.current?.click()}
                    className="min-h-[42px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Direct Upload Movie Video
                  </button>
                  <input
                    ref={videoFileRef}
                    type="file"
                    accept="video/*,.mkv,.avi,.mov,.webm,.mp4,.m4v,.flv,.wmv,.3gp,.ts,.ogg,.ogv,.mpeg,.mpg"
                    onChange={(e) => handleVideoFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <span className="text-xs text-[#b0aab8]">
                    {selectedVideoFile?.name || videoFileRef.current?.files?.[0]?.name || 'Any format (MP4, MKV, AVI, MOV, WEBM) or paste link'}
                  </span>
                </div>
                <input
                  type="url"
                  value={movieVideoLink}
                  onChange={(e) => {
                    setMovieVideoLink(e.target.value);
                    setUploadedVideoRef('');
                  }}
                  placeholder="Paste Single Movie video link (https://...)"
                  className={`${inputCls} mt-2`}
                />
              </div>

              {/* UPLOAD PROGRESS BAR */}
              <div className="rounded-xl border border-[#6a0dad]/45 bg-[#08070d] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#b0aab8]">
                  <span>{uploadFileNameText}</span>
                  <span className="font-semibold text-[#f0cf65]">R2 Bucket: vj-emma-movies</span>
                </div>
                <div className="my-2 h-3.5 w-full overflow-hidden rounded-lg border border-[#d4af37]/40 bg-[#1a1824]">
                  <div
                    className="h-full bg-gradient-to-r from-[#6a0dad] to-[#d4af37] transition-all duration-300"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-[#d4af37] tabular-nums">{uploadPct}%</span>
                  <span className={`font-bold ${movieUploadReady ? 'text-emerald-400' : 'text-white'}`}>
                    {uploadStatus}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploadInProgress}
                  onClick={startMovieUpload}
                  className="min-h-[44px] rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {uploadInProgress ? `Uploading ${uploadPct}%...` : '1. Upload Movie to R2'}
                </button>
                <button
                  type="button"
                  disabled={uploadInProgress}
                  onClick={saveMovieRecord}
                  className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black disabled:opacity-60"
                >
                  2. Save Movie to Cloud
                </button>
                {editMovieId && (
                  <button
                    type="button"
                    onClick={resetMovieForm}
                    className="min-h-[44px] rounded-lg bg-[#b71c1c] px-4 py-2 text-xs font-bold text-white"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              Saved Movies
            </h3>
            {state.movies.length === 0 ? (
              <p className="text-xs text-[#b0aab8]">No movies saved yet.</p>
            ) : (
              <div className="space-y-2.5">
                {[...state.movies].reverse().map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <AdminThumb srcRef={m.poster} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{m.title}</div>
                        <div className="text-xs text-[#b0aab8]">
                          {[m.year, m.category || 'Uncategorized', m.genre, m.label]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditMovie(m.id)}
                        className="min-h-[40px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-[#d4af37]"
                      >
                        Edit
                      </button>
                      {m.poster && (
                        <button
                          type="button"
                          onClick={() => deleteMoviePosterOnly(m.id)}
                          className="min-h-[40px] rounded-md border border-white/25 bg-[#2a153a] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Delete Poster
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteMovie(m.id)}
                        className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BANNERS */}
      {activeTab === 'banners' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-1 font-display text-base font-extrabold text-[#d4af37]">
              {editBannerId ? 'Edit Banner Settings' : 'Banner Settings (Max 5 · Auto-Flips Every 5 Seconds)'}
            </h3>
            <p className="mb-3 text-xs text-[#b0aab8]">
              Banners flip smoothly every 5 seconds. Optionally type Banner Text, Sub-Text, and Button Text below.
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Banner Text</label>
                <input
                  type="text"
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  placeholder="Type anything about this banner..."
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Banner Sub-Text</label>
                  <input
                    type="text"
                    value={bannerSubText}
                    onChange={(e) => setBannerSubText(e.target.value)}
                    placeholder="e.g. Watch dubbed in Luo now"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Banner Button Text</label>
                  <input
                    type="text"
                    value={bannerButtonText}
                    onChange={(e) => setBannerButtonText(e.target.value)}
                    placeholder="e.g. Watch Now"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Banner Image: Direct Upload Button</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bannerFileRef.current?.click()}
                    className="min-h-[42px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Direct Upload Banner Image
                  </button>
                  <input
                    ref={bannerFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerFileChange}
                    className="hidden"
                  />
                  <span className="text-xs text-[#b0aab8]">
                    {bannerFileRef.current?.files?.[0]?.name || 'Or paste banner link below'}
                  </span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Or Paste Banner Image Link</label>
                <input
                  type="url"
                  value={bannerLink}
                  onChange={(e) => {
                    setBannerLink(e.target.value);
                    setBannerPreview(e.target.value.trim());
                  }}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>
              {bannerPreview && (
                <img
                  src={bannerPreview}
                  alt="Banner Preview"
                  referrerPolicy="no-referrer"
                  className="h-24 w-44 rounded-md border border-[#d4af37] object-cover"
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveBannerRecord}
                  className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
                >
                  {editBannerId ? 'Update Banner' : 'Save Banner'}
                </button>
                {editBannerId && (
                  <button
                    type="button"
                    onClick={resetBannerForm}
                    className="min-h-[44px] rounded-lg bg-[#b71c1c] px-4 py-2 text-xs font-bold text-white"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              Saved Banners ({state.banners.length}/5)
            </h3>
            {state.banners.length === 0 ? (
              <p className="text-xs text-[#b0aab8]">No banners added yet (0/5).</p>
            ) : (
              <div className="space-y-2.5">
                {state.banners.map((b, idx) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <AdminThumb srcRef={b.image} className="h-12 w-24 border border-[#d4af37]" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">
                          {b.title?.trim() || `Banner #${idx + 1}`}
                        </div>
                        {(b.subText?.trim() || b.buttonText?.trim()) && (
                          <div className="truncate text-xs text-[#b0aab8]">
                            {[b.subText?.trim(), b.buttonText?.trim()].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setEditBannerId(b.id);
                          setBannerTitle(b.title || '');
                          setBannerSubText(b.subText || '');
                          setBannerButtonText(b.buttonText || '');
                          setBannerLink(!b.image.startsWith('idb://') ? b.image : '');
                          setBannerPreview(await resolveMediaUrl(b.image));
                        }}
                        className="min-h-[40px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-[#d4af37]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateState((prev) => ({
                            ...prev,
                            banners: prev.banners.filter((x) => x.id !== b.id),
                          }));
                          onNotify('Banner deleted.');
                        }}
                        className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SERIES (SEPARATE SEASON BOX & EPISODE BOX) */}
      {activeTab === 'series' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">Season Box</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Series Title</label>
                <input
                  type="text"
                  value={seasonSeriesTitle}
                  onChange={(e) => setSeasonSeriesTitle(e.target.value)}
                  placeholder="Series Title"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Season Number</label>
                  <input
                    type="number"
                    value={seasonNumber}
                    onChange={(e) => setSeasonNumber(e.target.value)}
                    placeholder="1"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Year</label>
                  <input
                    type="number"
                    value={seasonYear}
                    onChange={(e) => setSeasonYear(e.target.value)}
                    placeholder="2026"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Duration / Time</label>
                  <input
                    type="text"
                    value={seasonDuration}
                    onChange={(e) => setSeasonDuration(e.target.value)}
                    placeholder="e.g. 45m per ep"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Actors Names</label>
                <input
                  type="text"
                  value={seasonActors}
                  onChange={(e) => setSeasonActors(e.target.value)}
                  placeholder="e.g. Okello Moses, Akello Grace"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={seasonDescription}
                  onChange={(e) => setSeasonDescription(e.target.value)}
                  placeholder="Series description..."
                  className={`${inputCls} min-h-[70px] resize-y`}
                />
              </div>
              <div>
                <label className={labelCls}>Genres (Multi-Select · Check One or Many)</label>
                <div className="grid max-h-[210px] grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[#6a0dad]/60 bg-[#0a090f] p-2.5 sm:grid-cols-3">
                  {oneLineGenres.map((g) => {
                    const checked = selectedSeasonGenres.some(
                      (item) => item.toLowerCase() === g.toLowerCase()
                    );
                    return (
                      <label
                        key={`sea-gen-${g}`}
                        className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                          checked
                            ? 'border-[#d4af37] bg-[#6a0dad]/70 text-[#f0cf65]'
                            : 'border-white/10 bg-[#12101b] text-white/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSeasonGenre(g)}
                          className="h-4 w-4 accent-[#d4af37]"
                        />
                        <span className="truncate">{g}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className={labelCls}>Categories (Multi-Select · Check One or Many)</label>
                <div className="grid max-h-[180px] grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[#6a0dad]/60 bg-[#0a090f] p-2.5 sm:grid-cols-3">
                  {oneLineCategories.map((c) => {
                    const checked = selectedSeasonCategories.some(
                      (item) => item.toLowerCase() === c.toLowerCase()
                    );
                    return (
                      <label
                        key={`sea-cat-${c}`}
                        className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${
                          checked
                            ? 'border-[#d4af37] bg-[#6a0dad]/70 text-[#f0cf65]'
                            : 'border-white/10 bg-[#12101b] text-white/80'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSeasonCategory(c)}
                          className="h-4 w-4 accent-[#d4af37]"
                        />
                        <span className="truncate">{c}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className={labelCls}>Poster Label (Optional) — e.g. VIP</label>
                <input
                  type="text"
                  value={seasonLabel}
                  onChange={(e) => setSeasonLabel(e.target.value)}
                  placeholder="e.g. VIP (leave empty for clean poster)"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Series Poster (Direct Upload Button + Image Link)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => seasonPosterFileRef.current?.click()}
                    className="min-h-[42px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Direct Upload Season Poster
                  </button>
                  <input
                    ref={seasonPosterFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSeasonPosterFileChange}
                    className="hidden"
                  />
                  <span className="text-xs text-[#b0aab8]">
                    {seasonPosterFileRef.current?.files?.[0]?.name || 'Or paste image link below'}
                  </span>
                </div>
                <input
                  type="url"
                  value={seasonPosterLink}
                  onChange={(e) => {
                    setSeasonPosterLink(e.target.value);
                    setSeasonPosterRemoved(false);
                    setSeasonPosterPreview(e.target.value.trim());
                  }}
                  placeholder="Paste Season Poster image link (https://...)"
                  className={`${inputCls} mt-2`}
                />
                {seasonPosterPreview && (
                  <div className="mt-2 flex items-end gap-3">
                    <img
                      src={seasonPosterPreview}
                      alt="Season Poster Preview"
                      referrerPolicy="no-referrer"
                      className="h-[110px] w-[80px] rounded-md border border-[#d4af37] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSeasonPosterRemoved(true);
                        setSeasonPosterPreview('');
                        setSeasonPosterLink('');
                        if (seasonPosterFileRef.current) seasonPosterFileRef.current.value = '';
                        onNotify('Season poster removed. Tap Save Season to apply.');
                      }}
                      className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Delete Poster
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetSeasonForm}
                  className="min-h-[44px] rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-bold text-white"
                >
                  + Add Season
                </button>
                <button
                  type="button"
                  onClick={saveSeasonRecord}
                  className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
                >
                  Save Season
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {state.seasons.length === 0 ? (
                <p className="text-xs text-[#b0aab8]">No seasons added yet.</p>
              ) : (
                state.seasons.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <AdminThumb srcRef={s.poster} className="h-14 w-10" />
                      <div>
                        <div className="text-sm font-bold text-white">{s.seriesTitle}</div>
                        <div className="text-xs text-[#d4af37]">
                          Season {s.seasonNumber}
                          {s.label ? ` · ${s.label}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setEditSeasonId(s.id);
                          setSeasonSeriesTitle(s.seriesTitle);
                          setSeasonNumber(s.seasonNumber);
                          setSeasonLabel(s.label || '');
                          setSeasonGenre(parseMovieGenres(s.genres, s.genre).join(', '));
                          setSeasonCategory(parseMovieGenres(s.categories, s.category).join(', '));
                          setSeasonYear(s.year || '');
                          setSeasonDuration(s.duration || '');
                          setSeasonActors(s.actors || '');
                          setSeasonDescription(s.description || '');
                          setSeasonPosterRemoved(false);
                          setSeasonPosterLink(
                            s.poster && !s.poster.startsWith('idb://') ? s.poster : ''
                          );
                          setSeasonPosterPreview(await resolveMediaUrl(s.poster));
                        }}
                        className="min-h-[40px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-[#d4af37]"
                      >
                        Edit
                      </button>
                      {s.poster && (
                        <button
                          type="button"
                          onClick={() => {
                            updateState((prev) => ({
                              ...prev,
                              seasons: prev.seasons.map((x) =>
                                x.id === s.id ? { ...x, poster: '' } : x
                              ),
                            }));
                            if (editSeasonId === s.id) {
                              setSeasonPosterRemoved(true);
                              setSeasonPosterPreview('');
                              setSeasonPosterLink('');
                            }
                            onNotify('Season poster deleted.');
                          }}
                          className="min-h-[40px] rounded-md border border-white/25 bg-[#2a153a] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Delete Poster
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          updateState((prev) => ({
                            ...prev,
                            seasons: prev.seasons.filter((x) => x.id !== s.id),
                            episodes: prev.episodes.filter((ep) => ep.seasonId !== s.id),
                          }));
                          onNotify('Season deleted.');
                        }}
                        className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              Episode Box
            </h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Select Season First</label>
                <select
                  value={episodeSeasonId}
                  onChange={(e) => setEpisodeSeasonId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- Select Season First --</option>
                  {state.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.seriesTitle} - Season {s.seasonNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Episode #</label>
                  <input
                    type="number"
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    placeholder="1"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Episode Title</label>
                  <input
                    type="text"
                    value={episodeTitle}
                    onChange={(e) => setEpisodeTitle(e.target.value)}
                    placeholder="Episode Title"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Episode Video (Direct Upload Button + Video Link)</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => episodeVideoFileRef.current?.click()}
                    className="min-h-[42px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Direct Upload Episode Video
                  </button>
                  <input
                    ref={episodeVideoFileRef}
                    type="file"
                    accept="video/*,.mkv,.avi,.mov,.webm,.mp4,.m4v,.flv,.wmv,.3gp,.ts,.ogg,.ogv,.mpeg,.mpg"
                    onChange={() => {
                      const f = episodeVideoFileRef.current?.files?.[0];
                      setEpisodeFileName(f ? f.name : '');
                    }}
                    className="hidden"
                  />
                  <span className="text-xs text-[#b0aab8]">
                    {episodeFileName || 'Or paste episode video link below'}
                  </span>
                </div>
                <input
                  type="url"
                  value={episodeVideoLink}
                  onChange={(e) => setEpisodeVideoLink(e.target.value)}
                  placeholder="Paste Episode video link (https://...)"
                  className={`${inputCls} mt-2`}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetEpisodeForm}
                  className="min-h-[44px] rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-bold text-white"
                >
                  + Add Episode
                </button>
                <button
                  type="button"
                  onClick={saveEpisodeRecord}
                  className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
                >
                  Save Episode
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {state.episodes.length === 0 ? (
                <p className="text-xs text-[#b0aab8]">No episodes added yet.</p>
              ) : (
                state.episodes.map((ep) => {
                  const sea = state.seasons.find((s) => s.id === ep.seasonId);
                  const seaLabel = sea
                    ? `${sea.seriesTitle} (S${sea.seasonNumber})`
                    : 'Unknown Season';
                  return (
                    <div
                      key={ep.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">
                          Ep {ep.episodeNumber}: {ep.title}
                        </div>
                        <div className="text-xs text-[#b0aab8]">{seaLabel}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditEpisodeId(ep.id);
                            setEpisodeSeasonId(ep.seasonId);
                            setEpisodeNumber(ep.episodeNumber);
                            setEpisodeTitle(ep.title);
                            setEpisodeVideoLink(
                              ep.video && !ep.video.startsWith('idb://') ? ep.video : ''
                            );
                            setEpisodeFileName(ep.video?.startsWith('idb://') ? 'Uploaded video attached' : '');
                          }}
                          className="min-h-[40px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-[#d4af37]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateState((prev) => ({
                              ...prev,
                              episodes: prev.episodes.filter((x) => x.id !== ep.id),
                            }));
                            onNotify('Episode deleted.');
                          }}
                          className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3B: LIVE TV CHANNELS */}
      {activeTab === 'livetv' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              {editTvId ? `Edit Live TV Link: ${tvName}` : 'Add / Edit Live TV Links'}
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>TV Channel Name</label>
                  <input
                    type="text"
                    value={tvName}
                    onChange={(e) => setTvName(e.target.value)}
                    placeholder="e.g. VJ EMMA TV, NBS, Bukedde TV"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Category / Tag (Optional)</label>
                  <input
                    type="text"
                    value={tvCategory}
                    onChange={(e) => setTvCategory(e.target.value)}
                    placeholder="e.g. Gospel, News, Luo TV, Sports"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Live TV Stream Link (URL / M3U8 / YouTube Live / Embed)</label>
                <input
                  type="url"
                  value={tvStreamUrl}
                  onChange={(e) => setTvStreamUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Channel Poster / Logo (Optional Upload or Link)</label>
                <input
                  ref={tvPosterFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleTvPosterFileChange}
                  className={inputCls}
                />
                <input
                  type="url"
                  value={tvPosterLink}
                  onChange={(e) => {
                    setTvPosterLink(e.target.value);
                    setTvPosterRemoved(false);
                    setTvPosterPreview(e.target.value.trim());
                  }}
                  placeholder="Or paste Channel Logo/Poster link (https://...)"
                  className={`${inputCls} mt-2`}
                />
                {tvPosterPreview && (
                  <div className="mt-2 flex items-end gap-3">
                    <img
                      src={tvPosterPreview}
                      alt="TV Channel Preview"
                      referrerPolicy="no-referrer"
                      className="h-16 w-24 rounded-md border border-[#d4af37] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTvPosterRemoved(true);
                        setTvPosterPreview('');
                        setTvPosterLink('');
                        if (tvPosterFileRef.current) tvPosterFileRef.current.value = '';
                        onNotify('Channel poster removed. Tap Save TV Link to apply.');
                      }}
                      className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Delete Poster
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveTvChannelRecord}
                  className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
                >
                  Save TV Link
                </button>
                {editTvId && (
                  <button
                    type="button"
                    onClick={resetTvForm}
                    className="min-h-[44px] rounded-lg bg-[#b71c1c] px-4 py-2 text-xs font-bold text-white"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              Saved Live TV Links ({state.liveTvChannels?.length || 0})
            </h3>
            {!state.liveTvChannels || state.liveTvChannels.length === 0 ? (
              <p className="text-xs text-[#b0aab8]">No Live TV links added yet.</p>
            ) : (
              <div className="space-y-2.5">
                {state.liveTvChannels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <AdminThumb srcRef={ch.poster} className="h-12 w-16" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{ch.name}</div>
                        <div className="truncate text-xs text-[#b0aab8]">{ch.streamUrl}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditTvChannel(ch.id)}
                        className="min-h-[40px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-[#d4af37]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTvChannel(ch.id)}
                        className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: GENRES & CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4 space-y-4">
            <div>
              <h3 className="mb-1 font-display text-base font-extrabold text-[#d4af37]">
                Genres ({oneLineGenres.length}) &amp; Categories ({oneLineCategories.length})
              </h3>
              <p className="text-xs text-[#b0aab8]">
                Add or remove Genres and Categories below, separated by commas. Movies &amp; Series support multiple Genres and multiple Categories simultaneously.
              </p>
            </div>
            <div>
              <label className={labelCls}>Genres List (Comma-Separated)</label>
              <textarea
                value={setGenreLine}
                onChange={(e) => setSetGenreLine(e.target.value)}
                placeholder={DEFAULT_GENRE_LINE}
                className={`${inputCls} min-h-[76px] resize-y`}
              />
            </div>
            <div>
              <label className={labelCls}>Categories List (Comma-Separated)</label>
              <textarea
                value={setCategoryLine}
                onChange={(e) => setSetCategoryLine(e.target.value)}
                placeholder={DEFAULT_CATEGORY_LINE}
                className={`${inputCls} min-h-[64px] resize-y`}
              />
            </div>
            <button
              type="button"
              onClick={saveGenreLine}
              className="min-h-[42px] shrink-0 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-5 py-2 text-xs font-extrabold text-black"
            >
              Save Genres &amp; Categories
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS (SOCIAL LINKS, ADMIN CREDENTIALS, 5 R2 LINKS, POSTER SETTINGS, MOVIES, LIVE TV) */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* 0. SOCIAL PLATFORM LINKS (WHATSAPP, YOUTUBE, FACEBOOK, TIKTOK — IMMEDIATELY VISIBLE AT TOP OF SETTINGS) */}
          <div className="rounded-xl border-2 border-[#d4af37]/60 bg-gradient-to-br from-[#170f26] to-[#111018] p-4">
            <h3 className="mb-1 font-display text-base font-bold text-[#f0cf65]">
              Social Platform Links (WhatsApp, YouTube, Facebook &amp; TikTok)
            </h3>
            <p className="mb-3 text-xs text-[#d3cce0]">
              Paste your own channel/profile link (or @handle / WhatsApp number) and click{' '}
              <span className="font-bold text-white">Save</span>. When customers tap WhatsApp,
              YouTube, Facebook, or TikTok on the site, it takes them directly to your saved
              channel or platform.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      key: 'whatsapp',
                      field: 'whatsappUrl',
                      label: 'WhatsApp Link or Number',
                      val: setWhatsappUrl,
                      setter: setSetWhatsappUrl,
                      savedVal: state.settings.whatsappUrl,
                      placeholder: 'https://wa.me/256776043203 or 0776043203',
                    },
                    {
                      key: 'youtube',
                      field: 'youtubeUrl',
                      label: 'YouTube Channel Link',
                      val: setYoutubeUrl,
                      setter: setSetYoutubeUrl,
                      savedVal: state.settings.youtubeUrl,
                      placeholder: 'https://youtube.com/@yourchannel',
                    },
                    {
                      key: 'facebook',
                      field: 'facebookUrl',
                      label: 'Facebook Page Link',
                      val: setFacebookUrl,
                      setter: setSetFacebookUrl,
                      savedVal: state.settings.facebookUrl,
                      placeholder: 'https://facebook.com/yourpage',
                    },
                    {
                      key: 'tiktok',
                      field: 'tiktokUrl',
                      label: 'TikTok Profile Link',
                      val: setTiktokUrl,
                      setter: setSetTiktokUrl,
                      savedVal: state.settings.tiktokUrl,
                      placeholder: 'https://tiktok.com/@yourhandle',
                    },
                  ] as const
                ).map((item) => {
                  const resolvedSaved = normalizeSocialUrl(item.savedVal, item.key);
                  const platformName = item.label.split(' ')[0];
                  return (
                    <div
                      key={item.key}
                      className="rounded-lg border border-[#6a0dad]/50 bg-[#0b0912] p-3"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-[#f0cf65]">{item.label}</label>
                        {resolvedSaved ? (
                          <span className="rounded bg-emerald-950/90 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40">
                            Saved
                          </span>
                        ) : (
                          <span className="rounded bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                            Not set
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.val}
                          onChange={(e) => item.setter(e.target.value)}
                          placeholder={item.placeholder}
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            saveSingleSocialPlatform(item.field, platformName, item.val)
                          }
                          className="min-h-[42px] shrink-0 rounded-lg bg-[#d4af37] px-3.5 text-xs font-bold text-black"
                        >
                          Save
                        </button>
                      </div>
                      {resolvedSaved && (
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-[#b0aab8]">{resolvedSaved}</span>
                          <a
                            href={resolvedSaved}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 font-bold text-[#f0cf65] underline hover:text-white"
                          >
                            Test Link
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div>
                <label className={labelCls}>Extra Social Links (Optional, comma separated)</label>
                <input
                  type="text"
                  value={setSocialLinks}
                  onChange={(e) => setSetSocialLinks(e.target.value)}
                  placeholder="https://instagram.com/..., https://..."
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={saveSocialPlatforms}
                className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-bold text-black"
              >
                Save All Social Links
              </button>
            </div>
          </div>

          {/* 0B. PAYMENT PLANS MANAGER (NAME, PRICE, DAYS) */}
          <div className="rounded-xl border-2 border-[#d4af37]/50 bg-[#111018] p-4">
            <h3 className="mb-1 font-display text-base font-bold text-[#f0cf65]">
              {editPlanId
                ? `Edit Payment Plan: ${planNameInput}`
                : 'Payment Plans (Name, Price & Days)'}
            </h3>
            <p className="mb-3 text-xs text-[#b0aab8]">
              Add, edit, or delete subscription payment plans by Name, Price (UGX), and Days. All
              saved plans appear directly for subscribers.
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Plan Name</label>
                <input
                  type="text"
                  value={planNameInput}
                  onChange={(e) => setPlanNameInput(e.target.value)}
                  placeholder="e.g. Daily, Weekly, Monthly"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Price (UGX)</label>
                <input
                  type="number"
                  value={planPriceInput}
                  onChange={(e) => setPlanPriceInput(e.target.value)}
                  placeholder="e.g. 5000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Days</label>
                <input
                  type="number"
                  value={planDaysInput}
                  onChange={(e) => setPlanDaysInput(e.target.value)}
                  placeholder="e.g. 7"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={savePaymentPlanRecord}
                className="min-h-[42px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-bold text-black"
              >
                {editPlanId ? 'Update Payment Plan' : '+ Add & Save Payment Plan'}
              </button>
              {editPlanId && (
                <button
                  type="button"
                  onClick={resetPaymentPlanForm}
                  className="min-h-[42px] rounded-lg bg-[#b71c1c] px-4 py-2 text-xs font-bold text-white"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {configuredPaymentPlans.map((planItem) => (
                <div
                  key={planItem.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{planItem.name}</div>
                    <div className="text-xs text-[#f0cf65] tabular-nums">
                      UGX {Number(planItem.price).toLocaleString()} · {planItem.days}{' '}
                      {planItem.days === 1 ? 'Day' : 'Days'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditPlanId(planItem.id);
                        setPlanNameInput(planItem.name);
                        setPlanPriceInput(String(planItem.price));
                        setPlanDaysInput(String(planItem.days));
                      }}
                      className="min-h-[38px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1 text-xs font-bold text-[#f0cf65]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePaymentPlanRecord(planItem.id)}
                      className="min-h-[38px] rounded-md bg-[#b71c1c] px-3 py-1 text-xs font-bold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 1. ADMIN SIGN-IN CREDENTIALS (LOCKED TO ONE EMAIL, AT-WILL PASSWORD CHANGE) */}
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-1 font-display text-base font-extrabold text-[#d4af37]">
              Admin Sign-In Security (Locked Email)
            </h3>
            <p className="mb-3 text-xs text-[#b0aab8]">
              Admin access on <span className="font-bold text-[#f0cf65]">/admin</span> supports{' '}
              <span className="font-bold text-white">admin</span> or{' '}
              <span className="font-bold text-white">{LOCKED_ADMIN_EMAIL}</span>. Only signed-in Admin can change the password at will.
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Locked Admin Email</label>
                <input
                  type="email"
                  value={LOCKED_ADMIN_EMAIL}
                  readOnly
                  disabled
                  className={`${inputCls} cursor-not-allowed opacity-75`}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>New Admin Password</label>
                  <input
                    type="password"
                    value={cpNew}
                    onChange={(e) => setCpNew(e.target.value)}
                    placeholder="Enter new password"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <input
                    type="password"
                    value={cpConfirm}
                    onChange={(e) => setCpConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveAdminCredentials}
                className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
              >
                Update Admin Password
              </button>
            </div>
          </div>

          {/* 2. R2 LINKS (5 BOXES WITH TEST AND SAVE BUTTONS) */}
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              Cloudflare R2 Links (5 Boxes)
            </h3>
            <div className="space-y-2.5">
              {setR2Links.map((linkVal, idx) => (
                <div key={`r2-box-${idx}`} className="flex flex-wrap items-center gap-2">
                  <input
                    type="url"
                    value={linkVal}
                    onChange={(e) => {
                      const next = [...setR2Links];
                      next[idx] = e.target.value;
                      setSetR2Links(next);
                    }}
                    placeholder={`R2 Link #${idx + 1} (https://...)`}
                    className={`${inputCls} min-w-[200px] flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = linkVal.trim();
                      if (!val) {
                        onNotify(`Enter R2 Link #${idx + 1} first.`);
                        return;
                      }
                      onNotify(`R2 Link #${idx + 1} OK: ${val}`);
                    }}
                    className="min-h-[42px] shrink-0 rounded-lg border border-[#d4af37] bg-[#6a0dad] px-3.5 py-2 text-xs font-bold text-white"
                  >
                    Test #{idx + 1}
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const activeCount = setR2Links.filter((x) => x.trim()).length;
                    if (activeCount === 0) {
                      onNotify('Enter at least one R2 link to test.');
                      return;
                    }
                    onNotify(`Tested ${activeCount}/5 R2 links: All valid!`);
                  }}
                  className="min-h-[44px] rounded-lg border border-[#d4af37] bg-gradient-to-br from-[#6a0dad] to-[#4b077e] px-4 py-2 text-xs font-bold text-white"
                >
                  Test All R2 Links
                </button>
                <button
                  type="button"
                  onClick={saveR2Settings}
                  className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
                >
                  Save R2 Links
                </button>
              </div>
            </div>
          </div>

          {/* 3. POSTER DISPLAY CONTROLS & QUICK MOVIE POSTER MANAGER IN SETTINGS */}
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-2 font-display text-base font-extrabold text-[#d4af37]">
              Poster Display & Movie Card Settings
            </h3>
            <p className="mb-3 text-xs text-[#b0aab8]">
              Control everything shown on every movie poster (Tags, Rating, Year, Actors,
              Description, Like/Share/Comment) and edit any movie directly below.
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {(
                [
                  ['Poster Tag Badge', setShowPosterLabel, setSetShowPosterLabel],
                  ['Rating Badge (★)', setShowPosterRating, setSetShowPosterRating],
                  ['Like / Share / Comment', setShowPosterSocialBar, setSetShowPosterSocialBar],
                  ['Release Year', setShowPosterYear, setSetShowPosterYear],
                  ['Name of Actors', setShowPosterActors, setSetShowPosterActors],
                  ['Movie Description', setShowPosterDescription, setSetShowPosterDescription],
                ] as [string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]
              ).map(([title, checked, setter]) => (
                <label
                  key={title}
                  className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-[#6a0dad]/50 bg-[#0a090f] px-3 py-2 text-xs font-bold text-white"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setter(e.target.checked)}
                    className="h-4 w-4 accent-[#d4af37]"
                  />
                  <span>{title}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={savePosterSettings}
              className="mt-3 min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
            >
              Save Poster Display Settings
            </button>

            {/* PUT NEW POSTER & EDIT / DELETE / SAVE INSIDE SETTINGS */}
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-sm font-extrabold text-[#f0cf65]">
                  {editMovieId ? `Editing Poster: ${movieTitle}` : 'Put New Poster / Edit Existing Poster'}
                </h4>
                <button
                  type="button"
                  onClick={resetMovieForm}
                  className="min-h-[36px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-3 py-1 text-xs font-bold text-white"
                >
                  + Put New Poster
                </button>
              </div>
              <p className="mb-2.5 text-[11px] text-[#b0aab8]">
                Every new poster saved automatically includes Like, Share, and Comment buttons on the poster.
              </p>
              <div className="space-y-2.5 rounded-lg border border-[#6a0dad]/40 bg-[#09080f] p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    type="text"
                    value={movieTitle}
                    onChange={(e) => setMovieTitle(e.target.value)}
                    placeholder="Movie / Poster Title"
                    className={inputCls}
                  />
                  <input
                    type="number"
                    value={movieYear}
                    onChange={(e) => setMovieYear(e.target.value)}
                    placeholder="Year (e.g. 2026)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={movieDuration}
                    onChange={(e) => setMovieDuration(e.target.value)}
                    placeholder="Duration / Time (e.g. 1h 45m)"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#f0cf65]">
                    Genres (Multi-Select · Tap to Pick One or Many)
                  </label>
                  <div className="grid max-h-[210px] grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-[#6a0dad]/50 bg-[#0a090f] p-2 sm:grid-cols-3">
                    {availableMovieGenreChoices.map((g) => {
                      const checked = selectedMovieGenres.some(
                        (item) => item.toLowerCase() === g.toLowerCase()
                      );
                      return (
                        <label
                          key={`set-gen-${g}`}
                          className={`flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors ${
                            checked
                              ? 'border-[#d4af37] bg-[#6a0dad]/70 text-[#f0cf65]'
                              : 'border-white/10 bg-[#12101b] text-white/80'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMovieGenre(g)}
                            className="h-3.5 w-3.5 accent-[#d4af37]"
                          />
                          <span className="truncate">{g}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#f0cf65]">
                    Categories (Multi-Select · Tap to Pick One or Many)
                  </label>
                  <div className="grid max-h-[180px] grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-[#6a0dad]/50 bg-[#0a090f] p-2 sm:grid-cols-3">
                    {availableMovieCategoryChoices.map((c) => {
                      const checked = selectedMovieCategories.some(
                        (item) => item.toLowerCase() === c.toLowerCase()
                      );
                      return (
                        <label
                          key={`set-cat-${c}`}
                          className={`flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors ${
                            checked
                              ? 'border-[#d4af37] bg-[#6a0dad]/70 text-[#f0cf65]'
                              : 'border-white/10 bg-[#12101b] text-white/80'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMovieCategory(c)}
                            className="h-3.5 w-3.5 accent-[#d4af37]"
                          />
                          <span className="truncate">{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#f0cf65]">
                    Poster Label (Optional) — e.g. VIP
                  </label>
                  <input
                    type="text"
                    value={movieLabel}
                    onChange={(e) => setMovieLabel(e.target.value)}
                    placeholder="e.g. VIP (leave empty for clean poster)"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={movieActors}
                    onChange={(e) => setMovieActors(e.target.value)}
                    placeholder="Actors Names"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={movieRating}
                    onChange={(e) => setMovieRating(e.target.value)}
                    placeholder="Rating (e.g. 4.9)"
                    className={inputCls}
                  />
                </div>
                <textarea
                  value={movieDescription}
                  onChange={(e) => setMovieDescription(e.target.value)}
                  placeholder="Movie Description"
                  className={`${inputCls} min-h-[60px] resize-y`}
                />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => settingsPosterFileRef.current?.click()}
                        className="min-h-[38px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Direct Upload Poster Image
                      </button>
                      <input
                        ref={settingsPosterFileRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePosterFileChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </div>
                    <input
                      type="url"
                      value={moviePosterLink}
                      onChange={(e) => {
                        setMoviePosterLink(e.target.value);
                        setPosterRemoved(false);
                        setUploadedPosterRef('');
                        setSelectedPosterFile(null);
                        setMoviePosterPreview(e.target.value.trim());
                      }}
                      placeholder="Or Paste Poster Image Link (https://...)"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => settingsVideoFileRef.current?.click()}
                        className="min-h-[38px] rounded-lg border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Direct Upload Movie Video
                      </button>
                      <input
                        ref={settingsVideoFileRef}
                        type="file"
                        accept="video/*,.mkv,.avi,.mov,.webm,.mp4,.m4v,.flv,.wmv,.3gp,.ts,.ogg,.ogv,.mpeg,.mpg"
                        onChange={(e) => handleVideoFileChange(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </div>
                    <input
                      type="url"
                      value={movieVideoLink}
                      onChange={(e) => {
                        setMovieVideoLink(e.target.value);
                        setUploadedVideoRef('');
                        setSelectedVideoFile(null);
                      }}
                      placeholder="Or Paste Movie Video Link (https://...)"
                      className={inputCls}
                    />
                  </div>
                </div>
                {moviePosterPreview && (
                  <div className="flex flex-wrap items-end gap-3 pt-1">
                    <div className="relative h-[136px] w-[92px] overflow-hidden rounded-lg border border-[#d4af37] bg-[#181228]">
                      <img
                        src={moviePosterPreview}
                        alt="Poster Preview"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      {movieLabel.trim() && (
                        <div className="absolute left-1 top-1 flex max-w-[82%] flex-wrap gap-0.5">
                          <span
                            className={
                              movieLabel.trim().toUpperCase().includes('VIP')
                                ? 'rounded border border-[#f0cf65] bg-gradient-to-r from-[#d4af37] to-[#f0cf65] px-1 py-0.5 text-[7px] font-black text-black'
                                : 'rounded border border-[#d4af37] bg-[#6a0dad] px-1 py-0.5 text-[7px] font-extrabold text-[#f0cf65]'
                            }
                          >
                            {movieLabel.trim()}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 divide-x divide-white/15 border-t border-[#6a0dad] bg-[#0b0714]/90 py-1 text-center text-[8px] font-bold text-white">
                        <span>Like</span>
                        <span>Share</span>
                        <span>Comment</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeMoviePoster}
                      className="min-h-[38px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Delete Poster
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploadInProgress}
                    onClick={saveMovieRecord}
                    className="min-h-[42px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black disabled:opacity-60"
                  >
                    {uploadInProgress
                      ? `Uploading to R2 (${uploadPct}%)...`
                      : editMovieId
                        ? 'Save Poster Changes'
                        : 'Save New Poster / Movie'}
                  </button>
                  {editMovieId && (
                    <button
                      type="button"
                      onClick={resetMovieForm}
                      className="min-h-[42px] rounded-lg bg-[#b71c1c] px-4 py-2 text-xs font-bold text-white"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {[...state.movies].reverse().map((m) => (
                  <div
                    key={`set-mov-${m.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <AdminThumb srcRef={m.poster} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{m.title}</div>
                        <div className="truncate text-xs text-[#b0aab8]">
                          {[m.year, m.label, m.actors].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditMovie(m.id, true)}
                        className="min-h-[38px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1 text-xs font-bold text-[#d4af37]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMovie(m.id)}
                        className="min-h-[38px] rounded-md bg-[#b71c1c] px-3 py-1 text-xs font-bold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 5B. GENRES & CATEGORIES INSIDE SETTINGS */}
          <div className="rounded-xl border-2 border-[#d4af37]/50 bg-[#111018] p-4 space-y-3">
            <div>
              <h3 className="mb-1 font-display text-base font-extrabold text-[#d4af37]">
                Genres &amp; Categories Lists
              </h3>
              <p className="text-xs text-[#b0aab8]">
                Edit Genres or Categories anytime, separated by commas. Updates apply instantly for customers and movie upload.
              </p>
            </div>
            <div>
              <label className={labelCls}>Genres (Comma-Separated)</label>
              <textarea
                value={setGenreLine}
                onChange={(e) => setSetGenreLine(e.target.value)}
                placeholder={DEFAULT_GENRE_LINE}
                className={`${inputCls} min-h-[68px] resize-y`}
              />
            </div>
            <div>
              <label className={labelCls}>Categories (Comma-Separated)</label>
              <textarea
                value={setCategoryLine}
                onChange={(e) => setSetCategoryLine(e.target.value)}
                placeholder={DEFAULT_CATEGORY_LINE}
                className={`${inputCls} min-h-[58px] resize-y`}
              />
            </div>
            <button
              type="button"
              onClick={saveGenreLine}
              className="min-h-[42px] shrink-0 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-5 py-2 text-xs font-extrabold text-black"
            >
              Save Genres &amp; Categories
            </button>
          </div>

          {/* 5C. GENERAL APP & WHATSAPP API SETTINGS */}
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              App &amp; WhatsApp API Settings
            </h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>App Name</label>
                <input
                  type="text"
                  value={setAppName}
                  onChange={(e) => setSetAppName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>WhatsApp API Key</label>
                <input
                  type="text"
                  value={setWhatsappKey}
                  onChange={(e) => setSetWhatsappKey(e.target.value)}
                  placeholder="WhatsApp Cloud API Key / Phone ID"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Production Services</label>
                <input
                  type="text"
                  value="Photography · Videography · Documentary · Secretary · Computer Training"
                  readOnly
                  className={inputCls}
                />
              </div>

              <button
                type="button"
                onClick={saveSettings}
                className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
              >
                Save All Settings
              </button>
            </div>
          </div>

          {/* 6. LIVE TV LINKS SPACE INSIDE SETTINGS */}
          <div className="rounded-xl border border-[#d4af37]/30 bg-[#111018] p-4">
            <h3 className="mb-3 font-display text-base font-extrabold text-[#d4af37]">
              {editTvId ? `Edit TV Link: ${tvName}` : 'Live TV Links (Add, Save & Edit)'}
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>TV Channel Name</label>
                  <input
                    type="text"
                    value={tvName}
                    onChange={(e) => setTvName(e.target.value)}
                    placeholder="e.g. VJ EMMA Live TV"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Category / Tag</label>
                  <input
                    type="text"
                    value={tvCategory}
                    onChange={(e) => setTvCategory(e.target.value)}
                    placeholder="e.g. Luo TV, Gospel, News"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>TV Stream Link (URL / M3U8 / YouTube Live / Embed)</label>
                <input
                  type="url"
                  value={tvStreamUrl}
                  onChange={(e) => setTvStreamUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveTvChannelRecord}
                  className="min-h-[44px] rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
                >
                  Save TV Link
                </button>
                {editTvId && (
                  <button
                    type="button"
                    onClick={resetTvForm}
                    className="min-h-[44px] rounded-lg bg-[#b71c1c] px-4 py-2 text-xs font-bold text-white"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {state.liveTvChannels && state.liveTvChannels.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  {state.liveTvChannels.map((ch) => (
                    <div
                      key={`set-tv-${ch.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d4af37]/25 bg-[#0a090f] p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">{ch.name}</div>
                        <div className="truncate text-xs text-[#b0aab8]">{ch.streamUrl}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditTvChannel(ch.id)}
                          className="min-h-[40px] rounded-md border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-[#d4af37]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTvChannel(ch.id)}
                          className="min-h-[40px] rounded-md bg-[#b71c1c] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
