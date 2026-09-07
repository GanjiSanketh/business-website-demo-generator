import { Timestamp } from 'firebase/firestore';
import { ThemeOptions } from '../components/demo/themes/theme.registry';

export interface CustomDomainConfig {
  domain: string;
  /**
   * Custom domain lifecycle:
   *   - 'pending'   — connected, TXT ownership record not yet confirmed.
   *   - 'verified'  — DNS TXT ownership proven. NOT automatically served:
   *                   the domain must still be added to Firebase Hosting and
   *                   its DNS pointed at Firebase Hosting.
   *   - 'live'      — an HTTPS probe confirmed this application serves the
   *                   business' published demo on the domain (see the
   *                   checkCustomDomainLiveFn Cloud Function).
   *   - 'disabled'  — disconnected by the admin.
   */
  status: 'pending' | 'verified' | 'live' | 'disabled';
  verificationToken?: string;
  verifiedAt?: Timestamp | string;
}

export interface ServiceItem {
  name: string;
  description: string;
}

export interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string;
  close: string;
  closed?: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  /** Role / title, e.g. "Regular client" or "Member since 2021". */
  role?: string;
  quote: string;
  /** Optional rating, 1–5. */
  rating?: number;
  imageUrl?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

/** Social profile URLs. Every platform is optional. */
export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
  /** X (Twitter). */
  x?: string;
}

export type PrimaryCtaAction = 'phone' | 'whatsapp' | 'url' | 'scroll';

export interface PrimaryCta {
  enabled: boolean;
  label: string;
  actionType: PrimaryCtaAction;
  /** URL for actionType 'url'; section id for actionType 'scroll'. */
  value?: string;
}

export interface AnnouncementConfig {
  enabled: boolean;
  text: string;
  linkText?: string;
  linkUrl?: string;
}

export interface Business {
  id?: string;
  businessName: string;
  category: string;
  templateId: string;
  tagline: string;
  description: string;
  phone: string;
  whatsapp: string;
  address: string;
  logoUrl?: string;
  images?: string[];
  services?: ServiceItem[];
  slug: string;
  status: 'draft' | 'published';
  /** Set once when the business transitions to 'published' (persisted so
   *  published businesses carry a clear publish date). */
  publishedAt?: Timestamp;
  /** Selected theme preset id; resolved against the theme registry with a
   *  sensible per-template default when absent. */
  themeId?: string;
  /** Optional style overrides on top of the selected theme preset. */
  themeOptions?: ThemeOptions;
  /** Custom SEO title (falls back to businessName if not set). */
  seoTitle?: string;
  /** Custom meta description (falls back to description/tagline if not set). */
  seoDescription?: string;
  /** Optional SEO keywords. */
  seoKeywords?: string;
  /** Social sharing image URL (Open Graph / Twitter). */
  socialImageUrl?: string;
  /** Custom favicon URL. */
  faviconUrl?: string;
  /** Business hours. */
  businessHours?: BusinessHours;
  /** Optional customer testimonials/reviews. */
  testimonials?: Testimonial[];
  /** Optional frequently asked questions. */
  faqs?: FAQItem[];
  /** Optional social media profile URLs. */
  socialLinks?: SocialLinks;
  /** Optional configurable primary call-to-action. */
  primaryCta?: PrimaryCta;
  /** Optional announcement/promotion bar. */
  announcement?: AnnouncementConfig;
  /** Optional custom domain configuration. */
  customDomain?: CustomDomainConfig;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Normalize services to ServiceItem[] for templates (backward-compatible). */
export function normalizeServices(services?: string[] | ServiceItem[]): ServiceItem[] {
  if (!services?.length) return [];
  return services.map((s) =>
    typeof s === 'string' ? { name: s, description: '' } : { name: s.name || '', description: s.description || '' }
  );
}

/** Extract service names for backward-compatible storage (string[]). */
export function servicesToNames(services?: ServiceItem[]): string[] {
  if (!services?.length) return [];
  return services.map((s) => s.name).filter((n) => n.trim());
}
