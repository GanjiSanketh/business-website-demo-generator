import { Timestamp } from 'firebase/firestore';
import { ThemeOptions } from '../components/demo/themes/theme.registry';

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
  services?: string[];
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
