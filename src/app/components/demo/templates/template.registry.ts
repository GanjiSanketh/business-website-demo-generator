import { Type } from '@angular/core';
import { Business } from '../../../models/business.model';
import {
  DEFAULT_THEME_ID,
  ThemePreset,
  getThemeById,
  getThemes,
} from '../themes/theme.registry';

export interface TemplateMetadata {
  id: string;
  name: string;
  /** Category registry id this template belongs to (case-insensitive, e.g.
   *  "salon"). Display names come from the category registry. */
  categoryId: string;
  description: string;
  /** Visual mood of the template — used by generic pickers to style
   *  preview thumbnails without hardcoding per-template logic. */
  appearance?: 'light' | 'dark';
  /** Optional static preview asset (e.g. a pre-made screenshot). When
   *  absent, pickers generate a live thumbnail by rendering the template
   *  with the business' real data via the shared screenshot pipeline. */
  thumbnail?: string;
  /** Optional tags for future search/filtering (style, mood, layout, …). */
  tags?: string[];
  /** Theme used when the business has no explicit themeId. */
  defaultThemeId?: string;
  /** Theme ids this template supports; defaults to all registered themes. */
  supportedThemes?: string[];
  supported: boolean;
  component: Type<unknown>;
}

export const TEMPLATE_REGISTRY: Record<string, TemplateMetadata> = {
  'salon-01': {
    id: 'salon-01',
    name: 'Luxury Editorial',
    categoryId: 'salon',
    tags: ['editorial', 'luxury', 'serif'],
    appearance: 'light',
    description:
      'A refined ivory and charcoal editorial layout with arch imagery, serif display type, champagne accents and a masonry gallery.',
    defaultThemeId: 'classic-cream',
    supportedThemes: ['classic-cream', 'black-gold', 'rose-ivory', 'earthy-beige'],
    supported: true,
    component: null as unknown as Type<unknown>,
  },
  'salon-02': {
    id: 'salon-02',
    name: 'Modern Boutique',
    categoryId: 'salon',
    tags: ['modern', 'bold', 'dark'],
    appearance: 'dark',
    description:
      'A dark, gallery-forward boutique design with bold typography, dramatic contrast and a contemporary edge.',
    defaultThemeId: 'black-gold',
    supportedThemes: ['classic-cream', 'black-gold', 'rose-ivory', 'earthy-beige'],
    supported: true,
    component: null as unknown as Type<unknown>,
  },
  'restaurant-01': {
    id: 'restaurant-01',
    name: 'Fine Dining',
    categoryId: 'restaurant',
    tags: ['fine-dining', 'editorial', 'elegant', 'serif', 'dark'],
    appearance: 'dark',
    description:
      'A dark, image-driven editorial design with candlelit elegance — large food photography, champagne gold and a refined table-side feel.',
    defaultThemeId: 'midnight',
    supportedThemes: ['midnight', 'ivory-gold', 'burgundy'],
    supported: true,
    component: null as unknown as Type<unknown>,
  },
  'restaurant-02': {
    id: 'restaurant-02',
    name: 'Modern Café',
    categoryId: 'restaurant',
    tags: ['cafe', 'modern', 'warm', 'bold'],
    appearance: 'light',
    description:
      'A warm, contemporary café layout with bold modern type, friendly cards and a welcoming, editorial food-first feel.',
    defaultThemeId: 'warm-minimal',
    supportedThemes: ['warm-minimal', 'earthy', 'contemporary'],
    supported: true,
    component: null as unknown as Type<unknown>,
  },
  // ---- Gym Templates ----
  'gym-01': {
    id: 'gym-01',
    name: 'Powerful Dark',
    categoryId: 'gym',
    tags: ['fitness', 'dark', 'powerful', 'athletic'],
    appearance: 'dark',
    description:
      'A bold, high-energy dark design with large hero imagery, strong CTAs, program cards, and athletic visual identity.',
    defaultThemeId: 'power-dark',
    supportedThemes: ['power-dark', 'steel-dark', 'energy-dark'],
    supported: true,
    component: null as unknown as Type<unknown>,
  },
  'gym-02': {
    id: 'gym-02',
    name: 'Modern Fitness',
    categoryId: 'gym',
    tags: ['fitness', 'modern', 'clean', 'wellness'],
    appearance: 'light',
    description:
      'A clean, contemporary fitness design with vibrant accents, program showcases, and approachable wellness aesthetic.',
    defaultThemeId: 'fresh-light',
    supportedThemes: ['fresh-light', 'clean-slate', 'vitality-light'],
    supported: true,
    component: null as unknown as Type<unknown>,
  },
  // ---- Clothing Templates ----
  'clothing-01': {
    id: 'clothing-01',
    name: 'Fashion Editorial',
    categoryId: 'clothing-store',
    tags: ['fashion', 'editorial', 'luxury', 'magazine'],
    appearance: 'dark',
    description:
      'A high-end fashion magazine aesthetic with striking hero, editorial typography, and premium visual storytelling.',
    defaultThemeId: 'noir-editorial',
    supportedThemes: ['noir-editorial', 'champagne-luxe', 'monochrome-chic'],
    supported: true,
    component: null as unknown as Type<unknown>,
  },
  'clothing-02': {
    id: 'clothing-02',
    name: 'Modern Boutique',
    categoryId: 'clothing-store',
    tags: ['fashion', 'boutique', 'modern', 'ecommerce'],
    appearance: 'light',
    description:
      'A modern boutique ecommerce-inspired design with clean layout, visual merchandising, and strong product focus.',
    defaultThemeId: 'boutique-rose',
    supportedThemes: ['boutique-rose', 'modern-sand', 'urban-minimal'],
    supported: true,
    component: null as unknown as Type<unknown>,
  },
};

export function registerTemplateComponent(id: string, component: Type<unknown>): void {
  if (TEMPLATE_REGISTRY[id]) {
    TEMPLATE_REGISTRY[id].component = component;
  }
}

export function getTemplateMetadata(templateId: string): TemplateMetadata | undefined {
  return TEMPLATE_REGISTRY[templateId];
}

export function getTemplateComponent(templateId: string): Type<unknown> | null {
  const metadata = TEMPLATE_REGISTRY[templateId];
  return metadata?.component ?? null;
}

export function getSupportedTemplates(): TemplateMetadata[] {
  return Object.values(TEMPLATE_REGISTRY).filter((t) => t.supported);
}

export function getTemplatesForCategory(category: string): TemplateMetadata[] {
  return Object.values(TEMPLATE_REGISTRY).filter(
    (t) => t.categoryId.toLowerCase() === category.toLowerCase() && t.supported
  );
}

export function getDefaultTemplateForCategory(category: string): string | null {
  const templates = getTemplatesForCategory(category);
  return templates.length > 0 ? templates[0].id : null;
}

export function isTemplateSupported(templateId: string): boolean {
  const metadata = TEMPLATE_REGISTRY[templateId];
  return metadata?.supported ?? false;
}

export function getTemplateDisplayName(templateId: string): string {
  const metadata = TEMPLATE_REGISTRY[templateId];
  return metadata?.name ?? templateId;
}

/** Theme a business with this template falls back to when no themeId is set. */
export function getDefaultThemeForTemplate(templateId: string): string {
  return TEMPLATE_REGISTRY[templateId]?.defaultThemeId ?? DEFAULT_THEME_ID;
}

/** Themes a template supports (defaults to every registered theme). */
export function getSupportedThemesForTemplate(templateId: string): ThemePreset[] {
  const metadata = TEMPLATE_REGISTRY[templateId];
  if (!metadata?.supportedThemes) return getThemes();
  return metadata.supportedThemes
    .map((id) => getThemeById(id))
    .filter((t): t is ThemePreset => !!t);
}

export function getTemplateCategory(templateId: string): string {
  const metadata = TEMPLATE_REGISTRY[templateId];
  return metadata?.categoryId ?? '';
}