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
  // ---- Gym: Powerful Dark (gym-01) ----
  'power-dark': {
    id: 'power-dark',
    name: 'Power Dark',
    description:
      'Deep charcoal with electric lime — a bold, high-energy athletic statement.',
    appearance: 'dark',
    palette: ['#0d0d0d', '#1a1a1a', '#a8ff00', '#ffffff'],
    backgroundColor: '#0d0d0d',
    surfaceColor: '#1a1a1a',
    surfaceAltColor: '#232323',
    darkBgColor: '#000000',
    darkBgAltColor: '#0a0a0a',
    textColor: '#ffffff',
    textMutedColor: '#a0a0a0',
    textSubtleColor: '#707070',
    textInverseColor: '#0d0d0d',
    primaryColor: '#a8ff00',
    accentColor: '#ccff33',
    accentStrongColor: '#8acc00',
    accentSoftColor: 'rgba(168, 255, 0, 0.12)',
    accentTextColor: '#0d0d0d',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '8px',
    buttonStyle: 'sharp',
    heroStyle: 'image',
    cardStyle: 'flat',
    galleryStyle: 'masonry',
  },
  'steel-dark': {
    id: 'steel-dark',
    name: 'Steel Dark',
    description:
      'Dark steel with vibrant orange — industrial strength meets modern energy.',
    appearance: 'dark',
    palette: ['#111315', '#1c1f22', '#ff6b00', '#f0f0f0'],
    backgroundColor: '#111315',
    surfaceColor: '#1c1f22',
    surfaceAltColor: '#24282c',
    darkBgColor: '#08090a',
    darkBgAltColor: '#14171a',
    textColor: '#f0f0f0',
    textMutedColor: '#9aa0a6',
    textSubtleColor: '#6b7077',
    textInverseColor: '#111315',
    primaryColor: '#ff6b00',
    accentColor: '#ff8c33',
    accentStrongColor: '#cc5500',
    accentSoftColor: 'rgba(255, 107, 0, 0.12)',
    accentTextColor: '#111315',
    borderColor: 'rgba(240, 240, 240, 0.08)',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '6px',
    buttonStyle: 'sharp',
    heroStyle: 'split',
    cardStyle: 'bordered',
    galleryStyle: 'grid',
  },
  'energy-dark': {
    id: 'energy-dark',
    name: 'Energy Dark',
    description:
      'Obsidian with electric blue — intense, focused, performance-driven.',
    appearance: 'dark',
    palette: ['#0a0a0f', '#14141e', '#00d4ff', '#ffffff'],
    backgroundColor: '#0a0a0f',
    surfaceColor: '#14141e',
    surfaceAltColor: '#1c1c28',
    darkBgColor: '#050508',
    darkBgAltColor: '#0d0d14',
    textColor: '#ffffff',
    textMutedColor: '#a8aac8',
    textSubtleColor: '#787a98',
    textInverseColor: '#0a0a0f',
    primaryColor: '#00d4ff',
    accentColor: '#33ddff',
    accentStrongColor: '#00aacc',
    accentSoftColor: 'rgba(0, 212, 255, 0.12)',
    accentTextColor: '#0a0a0f',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '4px',
    buttonStyle: 'sharp',
    heroStyle: 'centered',
    cardStyle: 'elevated',
    galleryStyle: 'editorial',
  },
  // ---- Gym: Modern Fitness (gym-02) ----
  'fresh-light': {
    id: 'fresh-light',
    name: 'Fresh Light',
    description:
      'Clean white with vibrant green — fresh, approachable, modern wellness.',
    appearance: 'light',
    palette: ['#fafbfa', '#f0f5f0', '#2ecc71', '#1a2e1a'],
    backgroundColor: '#fafbfa',
    surfaceColor: '#f0f5f0',
    surfaceAltColor: '#ffffff',
    darkBgColor: '#1a2e1a',
    darkBgAltColor: '#244024',
    textColor: '#1a2e1a',
    textMutedColor: '#5a7a5a',
    textSubtleColor: '#8a9a8a',
    textInverseColor: '#fafbfa',
    primaryColor: '#2ecc71',
    accentColor: '#55dd88',
    accentStrongColor: '#25a058',
    accentSoftColor: '#e8f5e8',
    accentTextColor: '#ffffff',
    borderColor: '#d0e0d0',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '16px',
    buttonStyle: 'rounded',
    heroStyle: 'split',
    cardStyle: 'elevated',
    galleryStyle: 'editorial',
  },
  'clean-slate': {
    id: 'clean-slate',
    name: 'Clean Slate',
    description:
      'Minimal greyscale with electric blue accent — precise, professional, distraction-free.',
    appearance: 'light',
    palette: ['#fafafa', '#f0f0f0', '#0066ff', '#1a1a2e'],
    backgroundColor: '#fafafa',
    surfaceColor: '#f0f0f0',
    surfaceAltColor: '#ffffff',
    darkBgColor: '#1a1a2e',
    darkBgAltColor: '#242440',
    textColor: '#1a1a2e',
    textMutedColor: '#6a6a8a',
    textSubtleColor: '#9a9aae',
    textInverseColor: '#fafafa',
    primaryColor: '#0066ff',
    accentColor: '#3388ff',
    accentStrongColor: '#0052cc',
    accentSoftColor: '#e8eeff',
    accentTextColor: '#ffffff',
    borderColor: '#d8d8e8',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '8px',
    buttonStyle: 'soft',
    heroStyle: 'centered',
    cardStyle: 'bordered',
    galleryStyle: 'grid',
  },
  'vitality-light': {
    id: 'vitality-light',
    name: 'Vitality Light',
    description:
      'Warm off-white with coral energy — inviting, human, community-focused.',
    appearance: 'light',
    palette: ['#fdf8f5', '#f5ebe5', '#e67e5c', '#2e1a1a'],
    backgroundColor: '#fdf8f5',
    surfaceColor: '#f5ebe5',
    surfaceAltColor: '#fffefd',
    darkBgColor: '#2e1a1a',
    darkBgAltColor: '#402626',
    textColor: '#2e1a1a',
    textMutedColor: '#7a5a5a',
    textSubtleColor: '#aa8a8a',
    textInverseColor: '#fdf8f5',
    primaryColor: '#e67e5c',
    accentColor: '#f09a7a',
    accentStrongColor: '#cc6040',
    accentSoftColor: '#f8e8e0',
    accentTextColor: '#ffffff',
    borderColor: '#e8d8d0',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '12px',
    buttonStyle: 'rounded',
    heroStyle: 'image',
    cardStyle: 'flat',
    galleryStyle: 'masonry',
  },
  // ---- Clothing: Fashion Editorial (clothing-01) ----
  'noir-editorial': {
    id: 'noir-editorial',
    name: 'Noir Editorial',
    description:
      'Deep black with stark white — high-contrast fashion magazine aesthetic.',
    appearance: 'dark',
    palette: ['#0a0a0a', '#141414', '#ffffff', '#f0f0f0'],
    backgroundColor: '#0a0a0a',
    surfaceColor: '#141414',
    surfaceAltColor: '#1c1c1c',
    darkBgColor: '#000000',
    darkBgAltColor: '#080808',
    textColor: '#f0f0f0',
    textMutedColor: '#999999',
    textSubtleColor: '#666666',
    textInverseColor: '#0a0a0a',
    primaryColor: '#ffffff',
    accentColor: '#cccccc',
    accentStrongColor: '#999999',
    accentSoftColor: 'rgba(255, 255, 255, 0.06)',
    accentTextColor: '#0a0a0a',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '0',
    buttonStyle: 'sharp',
    heroStyle: 'image',
    cardStyle: 'flat',
    galleryStyle: 'editorial',
  },
  'champagne-luxe': {
    id: 'champagne-luxe',
    name: 'Champagne Luxe',
    description:
      'Warm champagne and deep charcoal — understated luxury for premium fashion.',
    appearance: 'light',
    palette: ['#f7f3ed', '#efe6dc', '#b8a078', '#1a1815'],
    backgroundColor: '#f7f3ed',
    surfaceColor: '#efe6dc',
    surfaceAltColor: '#fdfbf8',
    darkBgColor: '#1a1815',
    darkBgAltColor: '#2a2520',
    textColor: '#1a1815',
    textMutedColor: '#7a7065',
    textSubtleColor: '#a89a8a',
    textInverseColor: '#f7f3ed',
    primaryColor: '#b8a078',
    accentColor: '#d0b890',
    accentStrongColor: '#9a8560',
    accentSoftColor: '#f2ebe0',
    accentTextColor: '#1a1815',
    borderColor: '#e8dfd0',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '2px',
    buttonStyle: 'sharp',
    heroStyle: 'centered',
    cardStyle: 'bordered',
    galleryStyle: 'masonry',
  },
  'monochrome-chic': {
    id: 'monochrome-chic',
    name: 'Monochrome Chic',
    description:
      'Pure greyscale with surgical precision — modern, architectural, timeless.',
    appearance: 'light',
    palette: ['#ffffff', '#f5f5f5', '#333333', '#1a1a1a'],
    backgroundColor: '#ffffff',
    surfaceColor: '#f5f5f5',
    surfaceAltColor: '#fafafa',
    darkBgColor: '#1a1a1a',
    darkBgAltColor: '#2a2a2a',
    textColor: '#1a1a1a',
    textMutedColor: '#666666',
    textSubtleColor: '#999999',
    textInverseColor: '#ffffff',
    primaryColor: '#333333',
    accentColor: '#555555',
    accentStrongColor: '#222222',
    accentSoftColor: '#f0f0f0',
    accentTextColor: '#ffffff',
    borderColor: '#e0e0e0',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '0',
    buttonStyle: 'sharp',
    heroStyle: 'split',
    cardStyle: 'flat',
    galleryStyle: 'grid',
  },
  // ---- Clothing: Modern Boutique (clothing-02) ----
  'boutique-rose': {
    id: 'boutique-rose',
    name: 'Boutique Rose',
    description:
      'Soft blush with warm neutrals — feminine, inviting, contemporary boutique.',
    appearance: 'light',
    palette: ['#fdf5f5', '#f8ebe9', '#d4a5a5', '#2e1a1a'],
    backgroundColor: '#fdf5f5',
    surfaceColor: '#f8ebe9',
    surfaceAltColor: '#fffefe',
    darkBgColor: '#2e1a1a',
    darkBgAltColor: '#402626',
    textColor: '#2e1a1a',
    textMutedColor: '#8a6a6a',
    textSubtleColor: '#b89a9a',
    textInverseColor: '#fdf5f5',
    primaryColor: '#d4a5a5',
    accentColor: '#e8bdbd',
    accentStrongColor: '#b88888',
    accentSoftColor: '#f5e8e8',
    accentTextColor: '#ffffff',
    borderColor: '#f0d8d8',
    headingFont: FONT_HEADING,
    bodyFont: FONT_BODY,
    borderRadius: '20px',
    buttonStyle: 'rounded',
    heroStyle: 'split',
    cardStyle: 'elevated',
    galleryStyle: 'editorial',
  },
  'modern-sand': {
    id: 'modern-sand',
    name: 'Modern Sand',
    description:
      'Warm sand and deep espresso — natural, grounded, effortless style.',
    appearance: 'light',
    palette: ['#f5f0e8', '#ebe3d8', '#8b7355', '#1e1814'],
    backgroundColor: '#f5f0e8',
    surfaceColor: '#ebe3d8',
    surfaceAltColor: '#faf8f4',
    darkBgColor: '#1e1814',
    darkBgAltColor: '#2e251e',
    textColor: '#1e1814',
    textMutedColor: '#7a6a55',
    textSubtleColor: '#a89885',
    textInverseColor: '#f5f0e8',
    primaryColor: '#8b7355',
    accentColor: '#a89070',
    accentStrongColor: '#6d5840',
    accentSoftColor: '#efe8df',
    accentTextColor: '#ffffff',
    borderColor: '#e0d8cc',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '12px',
    buttonStyle: 'soft',
    heroStyle: 'image',
    cardStyle: 'bordered',
    galleryStyle: 'grid',
  },
  'urban-minimal': {
    id: 'urban-minimal',
    name: 'Urban Minimal',
    description:
      'Cool white with graphite — sharp, metropolitan, downtown edge.',
    appearance: 'light',
    palette: ['#fafafa', '#f0f0f0', '#4a4a4a', '#151515'],
    backgroundColor: '#fafafa',
    surfaceColor: '#f0f0f0',
    surfaceAltColor: '#fcfcfc',
    darkBgColor: '#151515',
    darkBgAltColor: '#222222',
    textColor: '#151515',
    textMutedColor: '#6a6a6a',
    textSubtleColor: '#999999',
    textInverseColor: '#fafafa',
    primaryColor: '#4a4a4a',
    accentColor: '#6a6a6a',
    accentStrongColor: '#333333',
    accentSoftColor: '#f0f0f0',
    accentTextColor: '#ffffff',
    borderColor: '#e0e0e0',
    headingFont: FONT_HEADING_MODERN,
    bodyFont: FONT_BODY,
    borderRadius: '4px',
    buttonStyle: 'sharp',
    heroStyle: 'centered',
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