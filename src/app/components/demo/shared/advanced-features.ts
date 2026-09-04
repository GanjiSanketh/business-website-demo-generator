/**
 * Shared helpers for the Phase 3 advanced website features. Pure functions —
 * templates consume these so the optional-feature behavior stays consistent
 * (filtering, URL validation, CTA resolution) without duplicating logic in
 * every template.
 */
import {
  Business,
  FAQItem,
  SocialLinks,
  Testimonial,
} from '../../../models/business.model';

export interface SocialLinkItem {
  platform: keyof SocialLinks;
  url: string;
  icon: string;
  label: string;
}

/** Bootstrap Icons + labels for the supported social platforms. */
const SOCIAL_META: Record<keyof SocialLinks, { icon: string; label: string }> = {
  instagram: { icon: 'bi-instagram', label: 'Instagram' },
  facebook: { icon: 'bi-facebook', label: 'Facebook' },
  youtube: { icon: 'bi-youtube', label: 'YouTube' },
  linkedin: { icon: 'bi-linkedin', label: 'LinkedIn' },
  x: { icon: 'bi-twitter-x', label: 'X (Twitter)' },
};

export const SOCIAL_PLATFORMS = Object.keys(SOCIAL_META) as (keyof SocialLinks)[];

/** True when value is a well-formed http(s) URL. */
export function isValidHttpUrl(value?: string | null): boolean {
  if (!value || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Configured social links (only platforms with a valid URL). */
export function getSocialLinks(business: Business): SocialLinkItem[] {
  const links = business.socialLinks ?? {};
  return SOCIAL_PLATFORMS.filter((platform) => isValidHttpUrl(links[platform])).map(
    (platform) => ({
      platform,
      url: links[platform]!.trim(),
      icon: SOCIAL_META[platform].icon,
      label: SOCIAL_META[platform].label,
    })
  );
}

/** Testimonials that actually have a quote (legacy/partial items are skipped). */
export function getTestimonials(business: Business): Testimonial[] {
  return (business.testimonials ?? []).filter(
    (t) => t && typeof t.quote === 'string' && t.quote.trim().length > 0
  );
}

/** FAQs that have both a question and an answer (invalid ones are skipped). */
export function getFaqs(business: Business): FAQItem[] {
  return (business.faqs ?? []).filter(
    (f) =>
      f &&
      typeof f.question === 'string' &&
      f.question.trim().length > 0 &&
      typeof f.answer === 'string' &&
      f.answer.trim().length > 0
  );
}

export interface ResolvedPrimaryCta {
  label: string;
  /** Direct link target (phone, WhatsApp, or external URL). */
  href?: string;
  /** Section id to scroll to (actionType 'scroll'). */
  scrollTo?: string;
  /** True when the link leaves the site (open in a new tab). */
  external: boolean;
}

/**
 * Resolve the optional primary CTA against the business' actual contact
 * details. Phone/WhatsApp actions reuse the phone/whatsapp the template
 * already normalizes (the business' own values, never hardcoded). Returns
 * null when disabled, empty-labelled, or invalid so templates can simply
 * hide the CTA.
 */
export function resolvePrimaryCta(
  business: Business,
  phoneUrl: string,
  whatsappUrl: string
): ResolvedPrimaryCta | null {
  const cta = business.primaryCta;
  if (!cta || !cta.enabled || !cta.label?.trim()) return null;
  const label = cta.label.trim();

  switch (cta.actionType) {
    case 'phone':
      // Prefer an explicit override value, else the business phone itself.
      return cta.value?.trim()
        ? { label, href: `tel:${cta.value.replace(/[^0-9+]/g, '')}`, external: false }
        : { label, href: phoneUrl, external: false };
    case 'whatsapp':
      return cta.value?.trim()
        ? {
            label,
            href: `https://wa.me/${cta.value.replace(/[^0-9]/g, '')}`,
            external: true,
          }
        : { label, href: whatsappUrl, external: true };
    case 'url':
      return isValidHttpUrl(cta.value)
        ? { label, href: cta.value!.trim(), external: true }
        : null;
    case 'scroll':
      return cta.value?.trim()
        ? { label, scrollTo: cta.value.trim(), external: false }
        : null;
    default:
      return null;
  }
}

/** True when the announcement bar should render (enabled + text). */
export function isAnnouncementEnabled(business: Business): boolean {
  const a = business.announcement;
  return !!(a && a.enabled && a.text && a.text.trim().length > 0);
}

/** Validated announcement link URL (null when absent or invalid). */
export function getAnnouncementLink(business: Business): string | null {
  const a = business.announcement;
  if (!a || !a.linkText?.trim() || !a.linkUrl?.trim()) return null;
  return isValidHttpUrl(a.linkUrl) ? a.linkUrl.trim() : null;
}

/**
 * Section ids the scroll CTA may target across the current templates. Kept
 * here so the builder can validate scroll targets against real sections.
 */
export const SCROLL_CTA_TARGETS: string[] = [
  'home',
  'about',
  'services',
  'menu',
  'gallery',
  'programs',
  'benefits',
  'hours',
  'testimonials',
  'faq',
  'contact',
];

/** Renders a 1–5 star summary as filled/empty bootstrap icons. */
export function starIcons(rating: number): { filled: number; empty: number } {
  const clamped = Math.min(5, Math.max(0, Math.round(rating || 0)));
  return { filled: clamped, empty: 5 - clamped };
}