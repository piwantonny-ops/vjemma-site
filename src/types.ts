export type AppView = 'home' | 'movies' | 'series' | 'livetv' | 'search' | 'profile' | 'admin';

export type AdminTab =
  | 'overview'
  | 'wallet'
  | 'clients'
  | 'media'
  | 'movies'
  | 'banners'
  | 'series'
  | 'livetv'
  | 'categories'
  | 'settings';

export type AccountStatus = 'pending' | 'approved' | 'blocked';

export type MovieLabel = string;

export interface PaymentPlan {
  id: string;
  name: string;
  price: number;
  days: number;
}

export type InfoModalType = 'about' | 'contacts' | 'terms' | 'privacy';

export interface LiveTvChannel {
  id: string;
  name: string;
  streamUrl: string;
  category?: string;
  poster?: string;
}

export interface Movie {
  id: string;
  title: string;
  year: string;
  duration?: string;
  rating: string;
  category: string;
  genre?: string;
  actors?: string;
  label: MovieLabel | string;
  description: string;
  poster: string;
  video: string;
  createdAt: number;
}

export interface Banner {
  id: string;
  image: string;
  title?: string;
  subText?: string;
  buttonText?: string;
}

export interface Season {
  id: string;
  seriesTitle: string;
  seasonNumber: string;
  poster: string;
  label?: string;
  year?: string;
  duration?: string;
  actors?: string;
  description?: string;
  genre?: string;
}

export interface Episode {
  id: string;
  seasonId: string;
  episodeNumber: string;
  title: string;
  video: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Genre {
  id: string;
  name: string;
}

export interface LikeRecord {
  count: number;
  liked: boolean;
}

export interface CommentItem {
  author: string;
  text: string;
  time: number;
}

export interface WalletTransaction {
  id: string;
  name?: string;
  phone: string;
  email: string;
  plan: string;
  amount: number;
  method: string;
  status: 'completed' | 'pending' | 'adjustment';
  createdAt: number;
}

export interface UserAccount {
  id: string;
  name?: string;
  phone: string;
  email: string;
  password: string;
  subscribed: boolean;
  plan: string | null;
  pendingPlan?: string | null;
  pendingAmount?: number;
  pendingDays?: number;
  paymentMethod?: string;
  status?: AccountStatus;
  expiry: number;
  createdAt: number;
}

export interface SessionUser {
  id?: string;
  name?: string;
  phone: string;
  email: string;
  role: 'admin' | 'customer';
  subscribed: boolean;
  plan: string | null;
  status?: AccountStatus;
  expiry: number;
}

export interface AppSettings {
  appName: string;
  r2Endpoint: string;
  r2Links: string[];
  pesapalKey: string;
  pesapalSecret: string;
  pesapalIpnUrl: string;
  whatsappKey: string;
  socialLinks: string;
  whatsappUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  genreLine?: string;
  movieTags: string[];
  paymentPlans: PaymentPlan[];
  priceWeekly: number;
  priceMonthly: number;
  priceVip: number;
  showPosterLabel: boolean;
  showPosterRating: boolean;
  showPosterSocialBar: boolean;
  showPosterYear: boolean;
  showPosterActors: boolean;
  showPosterDescription: boolean;
}

export interface AppState {
  wallet: number;
  walletTransactions?: WalletTransaction[];
  clients: number;
  users: UserAccount[];
  movies: Movie[];
  banners: Banner[];
  seasons: Season[];
  episodes: Episode[];
  liveTvChannels: LiveTvChannel[];
  categories: Category[];
  genres: Genre[];
  likes: Record<string, LikeRecord>;
  comments: Record<string, CommentItem[]>;
  adminEmail: string;
  adminPassword: string;
  currentUser: SessionUser | null;
  isAdminLoggedIn: boolean;
  settings: AppSettings;
}

export interface PendingPlan {
  planName: string;
  amount: number;
  days: number;
}

export interface PlayerMedia {
  title: string;
  videoUrl: string;
  description: string;
  fileName: string;
  isLive?: boolean;
}
