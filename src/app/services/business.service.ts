import { Injectable, signal } from '@angular/core';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { AuthService } from './auth.service';
import { Business } from '../models/business.model';

@Injectable({ providedIn: 'root' })
export class BusinessService {
  private db: ReturnType<typeof getFirestore> | undefined;
  private dbInitialized = false;
  private collectionName = 'businesses';

  businesses = signal<Business[]>([]);
  loading = signal(false);

  constructor(private authService: AuthService) {
    // Do NOT initialize Firestore here — Firebase may not be ready yet.
    // Use lazy init via getDb().
  }

  /**
   * Wrap a Firestore promise with a timeout so it never hangs forever.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Firestore operation "${label}" timed out after ${ms / 1000}s. This usually means the Firestore database has not been created in your Firebase project.`));
      }, ms);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Lazily initialize and return the Firestore instance.
   */
  private getDb() {
    if (this.db && this.dbInitialized) {
      return this.db;
    }

    try {
      const apps = getApps();
      if (apps.length === 0) {
        console.error('[BusinessService] No Firebase app found. Firebase may not be initialized.');
        throw new Error('Firebase is not initialized. Please refresh the page and try again.');
      }

      this.db = getFirestore(apps[0]);
      this.dbInitialized = true;
      console.log('[BusinessService] Firestore initialized successfully.');
      return this.db;
    } catch (err) {
      console.error('[BusinessService] Failed to initialize Firestore:', err);
      throw new Error('Firestore is not initialized. Please refresh the page and try again.');
    }
  }

  async getBusinesses(): Promise<Business[]> {
    this.loading.set(true);
    try {
      const db = this.getDb();
      const q = query(
        collection(db, this.collectionName),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await this.withTimeout(getDocs(q), 15000, 'getBusinesses');
      const businesses = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Business[];
      this.businesses.set(businesses);
      return businesses;
    } catch (err: any) {
      console.error('[BusinessService] getBusinesses error:', err);
      if (err?.message?.includes('NOT_FOUND') || err?.message?.includes('Could not reach')) {
        throw new Error('Firestore database is not available. Please create a Firestore database in your Firebase Console (Firestore Database → Create database).');
      }
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async getBusinessById(id: string): Promise<Business | null> {
    const db = this.getDb();
    const docRef = doc(db, this.collectionName, id);
    const snapshot = await this.withTimeout(getDoc(docRef), 15000, 'getBusinessById');
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Business;
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    const db = this.getDb();
    const q = query(
      collection(db, this.collectionName),
      where('slug', '==', slug),
      where('status', '==', 'published')
    );
    const snapshot = await this.withTimeout(getDocs(q), 15000, 'getBusinessBySlug');
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as Business;
  }

  async createBusiness(business: Business): Promise<string> {
    const db = this.getDb();
    const now = Timestamp.now();
    const dataToSave: DocumentData = {
      businessName: business.businessName || '',
      category: business.category || '',
      templateId: business.templateId || '',
      tagline: business.tagline || '',
      description: business.description || '',
      phone: business.phone || '',
      whatsapp: business.whatsapp || '',
      address: business.address || '',
      services: business.services || [],
      slug: business.slug || '',
      status: business.status || 'draft',
      createdAt: now,
      updatedAt: now,
    };

    if (business.logoUrl) {
      dataToSave['logoUrl'] = business.logoUrl;
    }
    if (business.images && business.images.length > 0) {
      dataToSave['images'] = business.images;
    }

    console.log('[BusinessService] Creating business document...');
    try {
      const docRef = await this.withTimeout(
        addDoc(collection(db, this.collectionName), dataToSave),
        15000,
        'createBusiness'
      );
      console.log('[BusinessService] Business created with ID:', docRef.id);
      return docRef.id;
    } catch (err: any) {
      console.error('[BusinessService] createBusiness error:', err);
      if (err?.message?.includes('NOT_FOUND') || err?.message?.includes('Could not reach')) {
        throw new Error('Firestore database is not available. Please create a Firestore database in your Firebase Console (Firestore Database → Create database).');
      }
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        throw new Error('You do not have permission to create businesses. Please check Firestore security rules.');
      }
      throw err;
    }
  }

  async updateBusiness(id: string, data: Partial<Business>): Promise<void> {
    const db = this.getDb();
    const docRef = doc(db, this.collectionName, id);

    const cleanData: DocumentData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id') {
        cleanData[key] = value;
      }
    }
    cleanData['updatedAt'] = Timestamp.now();

    console.log('[BusinessService] Updating business:', id);
    try {
      await this.withTimeout(updateDoc(docRef, cleanData), 15000, 'updateBusiness');
      console.log('[BusinessService] Business updated successfully.');
    } catch (err: any) {
      console.error('[BusinessService] updateBusiness error:', err);
      if (err?.message?.includes('NOT_FOUND') || err?.message?.includes('Could not reach')) {
        throw new Error('Firestore database is not available. Please create a Firestore database in your Firebase Console.');
      }
      throw err;
    }
  }

  async deleteBusiness(id: string): Promise<void> {
    const db = this.getDb();
    const docRef = doc(db, this.collectionName, id);
    await this.withTimeout(deleteDoc(docRef), 15000, 'deleteBusiness');
  }

  async duplicateBusiness(business: Business): Promise<string> {
    const baseSlug = this.generateSlug(business.businessName);
    const slug = await this.generateUniqueSlug(baseSlug);

    const duplicateData: Omit<Business, 'id'> = {
      businessName: business.businessName,
      category: business.category,
      templateId: business.templateId,
      tagline: business.tagline,
      description: business.description,
      phone: business.phone,
      whatsapp: business.whatsapp,
      address: business.address,
      services: business.services ? [...business.services] : [],
      slug,
      status: 'draft',
    };

    return this.createBusiness(duplicateData as Business);
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    const db = this.getDb();
    const q = query(
      collection(db, this.collectionName),
      where('slug', '==', slug)
    );
    const snapshot = await this.withTimeout(getDocs(q), 15000, 'isSlugUnique');
    if (snapshot.empty) return true;
    if (excludeId && snapshot.docs[0].id === excludeId) return true;
    return false;
  }

  async generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 2;

    while (!(await this.isSlugUnique(slug, excludeId))) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
