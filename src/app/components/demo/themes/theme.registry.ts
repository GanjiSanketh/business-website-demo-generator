/**
 * THEME REGISTRY — shared, generic visual configuration for demo templates.
 *
 * Architecture:  Business Data + Template + Theme  →  Rendered Website.
 *   - Templates control STRUCTURE (their own components).
 *   - Themes control APPEARANCE (CSS custom properties + option classes).
 *   - Business data controls CONTENT.
 *
 * Themes are pure data. Template components receive a resolved ThemeConfig
 * and apply it as inline CSS variables + modifier classes on their host —
 * no per-theme components, no dynamic stylesheet injection. Adding a theme
 * is a single registry entry; templates opt in via
 * TemplateMetadata.defaultThemeId / supportedThemes, so a future
 * restaurant/gym registry works the same way with zero picker changes.
 */

export type ButtonStyle = 'rounded' | 'soft' | 'sharp';
export type HeroStyle = 'image' | 'split' | 'centered';
export type CardStyle = 'flat' | 'bordered' | 'elevated';
export type GalleryStyle = 'editorial' | 'grid' | 'masonry';

/** The user-facing, persisted subset of choices (theme + style overrides). */
export interface ThemeOptions {
  buttonStyle?: ButtonStyle;
  heroStyle?: HeroStyle;
  galleryStyle?: GalleryStyle;
}

/** Visual data shared by registry presets and resolved configurations. */
export interface ThemeVisuals {
  // Palette — canonical CSS variables consumed by templates.
  backgroundColor: string; // page background
  surfaceColor: string; // section/alt backgrounds
  surfaceAltColor: string; // cards
  darkBgColor: string; // dark bands (hero/CTA/footer)
  darkBgAltColor: string; // secondary dark band
  textColor: string;
  textMutedColor: string;
  textSubtleColor: string;
  textInverseColor: string; // text on dark bands
  primaryColor: string; // main accent (buttons, highlights)
  accentColor: string; // brighter accent (hover, icons)
  accentStrongColor: string; // deep accent (text on soft accent)
  accentSoftColor: string; // translucent accent wash / chips
  accentTextColor: string; // text/icons placed on accent backgrounds
  borderColor: string;

  headingFont: string;
  bodyFont: string;
  borderRadius: string;

  buttonStyle: ButtonStyle;
  heroStyle: HeroStyle;
  cardStyle: CardStyle;
  galleryStyle: GalleryStyle;
}

/** Resolved visual configuration passed to template components. */
export interface ThemeConfig extends ThemeVisuals {
  themeId: string;
  themeName: string;
}

/** Registry entry: a full resolved look plus picker metadata. */
export interface ThemePreset extends ThemeVisuals {
  id: string;
  /** Display name used by pickers (ThemeConfig carries it as themeName). */
  name: string;
  description: string;
  appearance: 'light' | 'dark';
  /** Swatch colors for the picker: [bg, surface, accent, text]. */
  palette: string[];
}

const FONT_HEADING = "'Playfair Display', Georgia, 'Times New Roman', serif";
const FONT_BODY =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
// Modern display faces (café/bistro templates): bold sans headings, not serif.
const FONT_HEADING_MODERN = FONT_BODY;

export const DEFAULT_THEME_ID = 'classic-cream';

export const THEME_REGISTRY: Record<string, ThemePreset> = {
  'classic-cream': {
    id: 'classic-cream',
    name: 'Classic Cream',
    description:
      'Warm cream, charcoal and champagne gold — an elegant, timeless luxury look.',
    appearance: 'light',
    palette: ['#faf7f1', '#f3ede2', '#b08d57', '#211c15'],
    backgroundColor: '#faf7f1',
    surfaceColor: '#f3ede2',
    surfaceAltColor: '#fffdf9',
    darkBgColor: '#17140f',
    darkBgAltColor: '#221d15',
    textColor: '#211c15',
    textMutedColor: '#6f675a',
    textSubtleColor: '#9a9184',
    textInverseColor: '#faf7f1',
    primaryColor: '#b08d57',
    accentColor: '#c9a463',
    accentStrongColor: '#8f6f3c',
    accentSoftColor: '#efe6d3',
    accentTextColor: '#211c15',
    borderColor: '#e7dfd0',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '14px',
    buttonStyle: 'soft',
    heroStyle: 'split',
    cardStyle: 'bordered',
    galleryStyle: 'editorial',
  },
  'black-gold': {
    id: 'black-gold',
    name: 'Black & Gold',
    description:
      'Deep black with warm gold — a dramatic, premium evening-luxury statement.',
    appearance: 'dark',
    palette: ['#14110d', '#1d1913', '#c9a04a', '#f2ead9'],
    backgroundColor: '#14110d',
    surfaceColor: '#1d1913',
    surfaceAltColor: '#211c15',
    darkBgColor: '#0e0b08',
    darkBgAltColor: '#181410',
    textColor: '#f2ead9',
    textMutedColor: '#a89f8c',
    textSubtleColor: '#7d7568',
    textInverseColor: '#f2ead9',
    primaryColor: '#c9a04a',
    accentColor: '#e0b964',
    accentStrongColor: '#a9833a',
    accentSoftColor: 'rgba(201, 160, 74, 0.16)',
    accentTextColor: '#14110d',
    borderColor: 'rgba(242, 234, 217, 0.12)',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '10px',
    buttonStyle: 'sharp',
    heroStyle: 'image',
    cardStyle: 'flat',
    galleryStyle: 'masonry',
  },
  'rose-ivory': {
    id: 'rose-ivory',
    name: 'Rose & Ivory',
    description:
      'Soft ivory with a restrained rose accent — refined, feminine and sophisticated.',
    appearance: 'light',
    palette: ['#faf6f2', '#f4ece7', '#b76e79', '#2a2323'],
    backgroundColor: '#faf6f2',
    surfaceColor: '#f4ece7',
    surfaceAltColor: '#fffaf7',
    darkBgColor: '#241a1b',
    darkBgAltColor: '#2f2324',
    textColor: '#2a2323',
    textMutedColor: '#7d6f6a',
    textSubtleColor: '#a4938c',
    textInverseColor: '#faf6f2',
    primaryColor: '#b76e79',
    accentColor: '#c98a93',
    accentStrongColor: '#96535c',
    accentSoftColor: '#f3e2e2',
    accentTextColor: '#fffdfd',
    borderColor: '#eadcd8',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '18px',
    buttonStyle: 'rounded',
    heroStyle: 'centered',
    cardStyle: 'elevated',
    galleryStyle: 'grid',
  },
  'earthy-beige': {
    id: 'earthy-beige',
    name: 'Earthy Beige',
    description:
      'Warm beige and taupe with deep earthy tones — a natural boutique feel.',
    appearance: 'light',
    palette: ['#f4efe7', '#ece4d5', '#8a7a5c', '#2b241b'],
    backgroundColor: '#f4efe7',
    surfaceColor: '#ece4d5',
    surfaceAltColor: '#faf6ee',
    darkBgColor: '#262019',
    darkBgAltColor: '#342b21',
    textColor: '#2b241b',
    textMutedColor: '#7a6f5e',
    textSubtleColor: '#a0937f',
    textInverseColor: '#f4efe7',
    primaryColor: '#8a7a5c',
    accentColor: '#a3926f',
    accentStrongColor: '#6d5f45',
    accentSoftColor: '#e7ddca',
    accentTextColor: '#241e14',
    borderColor: '#ddd2bc',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '10px',
    buttonStyle: 'soft',
    heroStyle: 'split',
    cardStyle: 'bordered',
    galleryStyle: 'editorial',
  },
  // ---- Restaurant: Fine Dining (restaurant-01) ----
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description:
      'Deep charcoal with warm champagne gold — a hushed, candlelit fine-dining mood.',
    appearance: 'dark',
    palette: ['#12100e', '#1d1814', '#c9a45c', '#f2ecdf'],
    backgroundColor: '#12100e',
    surfaceColor: '#1a1612',
    surfaceAltColor: '#221c16',
    darkBgColor: '#0a0908',
    darkBgAltColor: '#15110d',
    textColor: '#f2ecdf',
    textMutedColor: '#b0a691',
    textSubtleColor: '#837a6b',
    textInverseColor: '#f2ecdf',
    primaryColor: '#c9a45c',
    accentColor: '#dcb874',
    accentStrongColor: '#a07f41',
    accentSoftColor: 'rgba(201, 164, 92, 0.15)',
    accentTextColor: '#17120a',
    borderColor: 'rgba(242, 236, 223, 0.12)',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '6px',
    buttonStyle: 'sharp',
    heroStyle: 'image',
    cardStyle: 'flat',
    galleryStyle: 'masonry',
  },
  'ivory-gold': {
    id: 'ivory-gold',
    name: 'Ivory & Gold',
    description:
      'Warm ivory, bronze-gold and ink — a bright, refined dining-room elegance.',
    appearance: 'light',
    palette: ['#faf5ec', '#f2ead9', '#a9834b', '#221b13'],
    backgroundColor: '#faf5ec',
    surfaceColor: '#f2ead9',
    surfaceAltColor: '#fffdf8',
    darkBgColor: '#1c1610',
    darkBgAltColor: '#2a2118',
    textColor: '#221b13',
    textMutedColor: '#75684f',
    textSubtleColor: '#a89a7f',
    textInverseColor: '#faf5ec',
    primaryColor: '#a9834b',
    accentColor: '#c09a5e',
    accentStrongColor: '#87652f',
    accentSoftColor: '#eee2c9',
    accentTextColor: '#241a0d',
    borderColor: '#e5dac2',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '4px',
    buttonStyle: 'sharp',
    heroStyle: 'image',
    cardStyle: 'bordered',
    galleryStyle: 'editorial',
  },
  burgundy: {
    id: 'burgundy',
    name: 'Burgundy',
    description:
      'Deep wine and blushing rose with warm gold — a romantic, opulent tableside mood.',
    appearance: 'dark',
    palette: ['#1a1013', '#241820', '#c77a6e', '#f3e9e7'],
    backgroundColor: '#1a1013',
    surfaceColor: '#241820',
    surfaceAltColor: '#2d1f25',
    darkBgColor: '#120a0d',
    darkBgAltColor: '#201418',
    textColor: '#f3e9e7',
    textMutedColor: '#b3a09d',
    textSubtleColor: '#8a736f',
    textInverseColor: '#f3e9e7',
    primaryColor: '#a9554e',
    accentColor: '#c9806f',
    accentStrongColor: '#7d3b36',
    accentSoftColor: 'rgba(169, 85, 78, 0.18)',
    accentTextColor: '#f8efed',
    borderColor: 'rgba(243, 233, 231, 0.14)',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '10px',
    buttonStyle: 'soft',
    heroStyle: 'image',
    cardStyle: 'flat',
    galleryStyle: 'editorial',
  },
  // ---- Restaurant: Modern Café (restaurant-02) ----
  'warm-minimal': {
    id: 'warm-minimal',
    name: 'Warm Minimal',
    description:
      'Cream and warm terracotta with bold modern type — friendly, contemporary and clean.',
    appearance: 'light',
    palette: ['#f7f2ea', '#efe7d9', '#b4683c', '#2b211a'],
    backgroundColor: '#f7f2ea',
    surfaceColor: '#efe7d9',
    surfaceAltColor: '#fdfaf3',
    darkBgColor: '#2b2017',
    darkBgAltColor: '#3a2c20',
    textColor: '#2b211a',
    textMutedColor: '#77684f',
    textSubtleColor: '#a4957d',
    textInverseColor: '#fdfaf3',
    primaryColor: '#b4683c',
    accentColor: '#c9804f',
    accentStrongColor: '#93491f',
    accentSoftColor: '#f0ddcd',
    accentTextColor: '#fffaf4',
    borderColor: '#e6d9c3',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '16px',
    buttonStyle: 'rounded',
    heroStyle: 'split',
    cardStyle: 'elevated',
    galleryStyle: 'editorial',
  },
  earthy: {
    id: 'earthy',
    name: 'Earthy',
    description:
      'Sand, leather and olive — a grounded natural palette with artisan café warmth.',
    appearance: 'light',
    palette: ['#f3eee4', '#eae1cf', '#8a6a3f', '#2c2417'],
    backgroundColor: '#f3eee4',
    surfaceColor: '#eae1cf',
    surfaceAltColor: '#faf6ec',
    darkBgColor: '#26211a',
    darkBgAltColor: '#342c22',
    textColor: '#2c2417',
    textMutedColor: '#77674e',
    textSubtleColor: '#a08d6f',
    textInverseColor: '#faf6ec',
    primaryColor: '#8a6a3f',
    accentColor: '#a07f50',
    accentStrongColor: '#6e4f2b',
    accentSoftColor: '#e6d8bf',
    accentTextColor: '#faf6ec',
    borderColor: '#ddd0b4',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '12px',
    buttonStyle: 'soft',
    heroStyle: 'split',
    cardStyle: 'bordered',
    galleryStyle: 'grid',
  },
  contemporary: {
    id: 'contemporary',
    name: 'Contemporary',
    description:
      'Warm greys with deep eucalyptus green — a modern, design-led café aesthetic.',
    appearance: 'light',
    palette: ['#f3f1ec', '#e9e6df', '#2e6b5e', '#1f2322'],
    backgroundColor: '#f3f1ec',
    surfaceColor: '#e9e6df',
    surfaceAltColor: '#fbfaf7',
    darkBgColor: '#1f2322',
    darkBgAltColor: '#2c3230',
    textColor: '#1f2322',
    textMutedColor: '#626763',
    textSubtleColor: '#92968f',
    textInverseColor: '#fbfaf7',
    primaryColor: '#2e6b5e',
    accentColor: '#3f8577',
    accentStrongColor: '#1f5349',
    accentSoftColor: '#dcebe5',
    accentTextColor: '#f0faf7',
    borderColor: '#d9d8d0',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '12px',
    buttonStyle: 'soft',
    heroStyle: 'image',
    cardStyle: 'flat',
    galleryStyle: 'masonry',
  },
};

export function getThemeById(themeId: string): ThemePreset | undefined {
  return THEME_REGISTRY[themeId];
}

export function getThemes(): ThemePreset[] {
  return Object.values(THEME_REGISTRY);
}

export function getThemeDisplayName(
  themeId?: string | null,
  fallback?: string
): string {
  const preset = themeId ? THEME_REGISTRY[themeId] : undefined;
  return preset?.name ?? fallback ?? 'Default';
}

const BTN_RADIUS: Record<ButtonStyle, string> = {
  rounded: '999px',
  soft: '12px',
  sharp: '2px',
};

/**
 * Resolve the persisted choices (themeId + optional style overrides) into a
 * full ThemeConfig, falling back to a template's default theme and then the
 * global default. Unknown theme ids degrade gracefully to the default.
 */
export function resolveThemeConfig(
  themeId?: string | null,
  options?: ThemeOptions,
  defaultThemeId?: string
): ThemeConfig {
  const preset =
    THEME_REGISTRY[themeId ?? ''] ??
    THEME_REGISTRY[defaultThemeId ?? ''] ??
    THEME_REGISTRY[DEFAULT_THEME_ID]!;

  return {
    ...preset,
    themeId: preset.id,
    themeName: preset.name,
    buttonStyle: options?.buttonStyle ?? preset.buttonStyle,
    heroStyle: options?.heroStyle ?? preset.heroStyle,
    galleryStyle: options?.galleryStyle ?? preset.galleryStyle,
    cardStyle: preset.cardStyle,
  };
}

/** Inline CSS custom properties a template applies on its host element. */
export function buildThemeCss(theme: ThemeConfig): string {
  return [
    `--theme-bg: ${theme.backgroundColor}`,
    `--theme-surface: ${theme.surfaceColor}`,
    `--theme-surface-alt: ${theme.surfaceAltColor}`,
    `--theme-dark-bg: ${theme.darkBgColor}`,
    `--theme-dark-bg-alt: ${theme.darkBgAltColor}`,
    `--theme-text: ${theme.textColor}`,
    `--theme-text-muted: ${theme.textMutedColor}`,
    `--theme-text-subtle: ${theme.textSubtleColor}`,
    `--theme-text-inverse: ${theme.textInverseColor}`,
    `--theme-accent: ${theme.primaryColor}`,
    `--theme-accent-bright: ${theme.accentColor}`,
    `--theme-accent-strong: ${theme.accentStrongColor}`,
    `--theme-accent-soft: ${theme.accentSoftColor}`,
    `--theme-accent-text: ${theme.accentTextColor}`,
    `--theme-border: ${theme.borderColor}`,
    `--theme-font-heading: ${theme.headingFont}`,
    `--theme-font-body: ${theme.bodyFont}`,
    `--theme-radius: ${theme.borderRadius}`,
    `--theme-btn-radius: ${BTN_RADIUS[theme.buttonStyle]}`,
  ].join(';') + ';';
}

/** Modifier classes a template applies on its host for style options. */
export function themeOptionClasses(theme: ThemeConfig): string {
  return [
    `theme-btn-${theme.buttonStyle}`,
    `theme-hero-${theme.heroStyle}`,
    `theme-card-${theme.cardStyle}`,
    `theme-gallery-${theme.galleryStyle}`,
  ].join(' ');
}

// ---- Option catalogs (shared by any picker UI) ----

export const BUTTON_STYLE_OPTIONS: { value: ButtonStyle; label: string }[] = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'soft', label: 'Soft' },
  { value: 'sharp', label: 'Sharp' },
];

export const HERO_STYLE_OPTIONS: { value: HeroStyle; label: string }[] = [
  { value: 'image', label: 'Image Focused' },
  { value: 'split', label: 'Split Layout' },
  { value: 'centered', label: 'Centered' },
];

export const GALLERY_STYLE_OPTIONS: { value: GalleryStyle; label: string }[] = [
  { value: 'editorial', label: 'Editorial' },
  { value: 'grid', label: 'Grid' },
  { value: 'masonry', label: 'Masonry' },
];