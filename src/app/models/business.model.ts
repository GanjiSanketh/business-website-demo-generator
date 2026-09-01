import { Timestamp } from 'firebase/firestore';

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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
