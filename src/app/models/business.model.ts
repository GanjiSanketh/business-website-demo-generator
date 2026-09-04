import { Timestamp } from 'firebase/firestore';
import { ThemeOptions } from '../components/demo/themes/theme.registry';

export interface ServiceItem {
  name: string;
  description: string;
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
  /** Selected theme preset id; resolved against the theme registry with a
   *  sensible per-template default when absent. */
  themeId?: string;
  /** Optional style overrides on top of the selected theme preset. */
  themeOptions?: ThemeOptions;
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
