/**
 * CATEGORY REGISTRY — centralized business categories.
 *
 * Architecture:  Category Registry → Template Registry → Theme Registry →
 *                Business Data → Renderer.
 *   - Categories answer "what kind of business is this?" and scope which
 *     template designs can apply.
 *   - Template availability is DERIVED from the template registry — it is
 *     never duplicated here (getTemplateCountForCategory / the template
 *     registry's getTemplatesForCategory are the single source of truth).
 *
 * Category ids are stable, lowercase slugs persisted on Business.category.
 * Matching is case-insensitive everywhere, so pre-registry records such as
 * "Salon" keep loading and rendering untouched. Names / descriptions / icons
 * are presentation metadata: consumers render getCategoryDisplayName(), never
 * raw ids.
 *
 * Adding a category = one registry entry (+ templates that declare its
 * categoryId). No picker, form or dashboard code changes are required.
 */

import { getTemplatesForCategory } from '../templates/template.registry';

export interface CategoryMetadata {
  /** Stable persisted id (Business.category). Lowercase slug. */
  id: string;
  /** Friendly name shown to users, e.g. "Salon & Beauty". */
  name: string;
  /** One-line description used by category pickers. */
  description: string;
  /** Bootstrap Icons class, e.g. "bi-scissors". */
  icon: string;
  /** Sort order in pickers (lower first). */
  order: number;
}

export const DEFAULT_CATEGORY_ID = 'salon';

export const CATEGORY_REGISTRY: Record<string, CategoryMetadata> = {
  salon: {
    id: 'salon',
    name: 'Salon & Beauty',
    description: 'Salons, barbershops, spas & beauty studios',
    icon: 'bi-scissors',
    order: 1,
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant & Dining',
    description: 'Professional websites for restaurants, cafés and dining businesses',
    icon: 'bi-cup-hot',
    order: 2,
  },
  gym: {
    id: 'gym',
    name: 'Gym & Fitness',
    description: 'Gyms, fitness & wellness centers',
    icon: 'bi-dumbbell',
    order: 3,
  },
  'clothing-store': {
    id: 'clothing-store',
    name: 'Clothing Store',
    description: 'Fashion boutiques & retail stores',
    icon: 'bi-bag',
    order: 4,
  },
  clinic: {
    id: 'clinic',
    name: 'Clinic',
    description: 'Medical, dental & wellness clinics',
    icon: 'bi-heart-pulse',
    order: 5,
  },
  'real-estate': {
    id: 'real-estate',
    name: 'Real Estate',
    description: 'Agencies & property services',
    icon: 'bi-house-door',
    order: 6,
  },
  hotel: {
    id: 'hotel',
    name: 'Hotel',
    description: 'Hotels, stays & hospitality',
    icon: 'bi-buildings',
    order: 7,
  },
  photography: {
    id: 'photography',
    name: 'Photography',
    description: 'Photography & creative studios',
    icon: 'bi-camera',
    order: 8,
  },
};

/** Canonical key for a category value: trim + lowercase, so registry ids,
 *  persisted ids and legacy labels all compare equal ("Salon" → "salon"). */
export function normalizeCategoryKey(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function getCategories(): CategoryMetadata[] {
  return Object.values(CATEGORY_REGISTRY).sort((a, b) => a.order - b.order);
}

export function getCategoryById(
  value?: string | null
): CategoryMetadata | undefined {
  return CATEGORY_REGISTRY[normalizeCategoryKey(value)];
}

/** Friendly name from a registry id or a legacy label ("Salon" → "Salon &
 *  Beauty"). Unknown values pass through unchanged so old records never
 *  render blank. */
export function getCategoryDisplayName(
  value?: string | null,
  fallback = ''
): string {
  const meta = getCategoryById(value);
  if (meta) return meta.name;
  const raw = (value ?? '').trim();
  return raw || fallback;
}

export function getCategoryDescription(value?: string | null): string {
  return getCategoryById(value)?.description ?? '';
}

export function getCategoryIcon(value?: string | null): string {
  return getCategoryById(value)?.icon ?? 'bi-grid';
}

/** Number of templates registered for a category (0 → "coming soon"). */
export function getTemplateCountForCategory(value?: string | null): number {
  return getTemplatesForCategory(value ?? '').length;
}

export function hasTemplatesForCategory(value?: string | null): boolean {
  return getTemplateCountForCategory(value) > 0;
}

export function getDefaultCategoryId(): string {
  return DEFAULT_CATEGORY_ID;
}
