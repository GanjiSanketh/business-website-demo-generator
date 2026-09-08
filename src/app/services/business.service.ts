import { Injectable, signal } from '@angular/core';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { Business, CustomDomainConfig } from '../models/business.model';
import {
  normalizeHostname,
  isPlatformHost,
} from '../components/demo/shared/domain-utils';

@Injectable({ providedIn: 'root' })
export class BusinessService {
  private db: ReturnType<typeof getFirestore> | undefined;
  private dbInitialized = false;
  private functions: ReturnType<typeof getFunctions> | undefined;
  private functionsInitialized = false;
  private collectionName = 'businesses';

  businesses = signal<Business[]>([]);
  loading = signal(false);

  constructor(
    private authService: AuthService,
    private userService: UserService
  ) {}

  private async getFunctionsInstance() {
    if (this.functions && this.functionsInitialized) {
      return this.functions;
    }

    await this.authService.ready;

    try {
      const apps = getApps();
      if (apps.length === 0) {
        throw new Error('Firebase app not initialized');
      }
      this.functions = getFunctions(apps[0]);
      this.functionsInitialized = true;
      return this.functions;
    } catch (err) {
      console.error('[BusinessService] Failed to initialize Functions:', err);
      throw new Error('Firebase Functions is not initialized. Please refresh the page and try again.');
    }
  }

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

  private async getDb() {
    if (this.db && this.dbInitialized) {
      return this.db;
    }

    await this.authService.ready;

    try {
      const apps = getApps();
      if (apps.length === 0) {
        console.error('[BusinessService] No Firebase app found. Firebase may not be initialized.');
        throw new Error('Firebase is not initialized. Please refresh the page and try again.');
      }

      this.db = getFirestore(apps[0]);
      this.dbInitialized = true;
      return this.db;
    } catch (err) {
      console.error('[BusinessService] Failed to initialize Firestore:', err);
      throw new Error('Firestore is not initialized. Please refresh the page and try again.');
    }
  }

  private getCurrentUserId(): string {
    const user = this.authService.currentUser();
    if (!user) throw new Error('No authenticated user');
    return user.uid;
  }

  private isAdmin(): boolean {
    return this.userService.isAdmin();
  }

  async getBusinesses(): Promise<Business[]> {
    this.loading.set(true);
    try {
      const db = await this.getDb();
      let q;

      if (this.isAdmin()) {
        q = query(
          collection(db, this.collectionName),
          orderBy('createdAt', 'desc')
        );
      } else {
        const ownerId = this.getCurrentUserId();
        q = query(
          collection(db, this.collectionName),
          where('ownerId', '==', ownerId),
          orderBy('createdAt', 'desc')
        );
      }

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
    const db = await this.getDb();
    const docRef = doc(db, this.collectionName, id);
    const snapshot = await this.withTimeout(getDoc(docRef), 15000, 'getBusinessById');
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Business;
  }

  async getBusinessBySlug(slug: string): Promise<Business | null> {
    const db = await this.getDb();
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

  private hostSlugCache = new Map<string, { slug: string; expiresAt: number }>();
  private static readonly HOST_CACHE_TTL_MS = 60_000;

  async getBusinessByHost(host: string): Promise<Business | null> {
    const key = normalizeHostname(host);
    if (!key || isPlatformHost(key)) return null;

    const cached = this.hostSlugCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.slug ? this.getBusinessBySlug(cached.slug) : null;
    }

    const db = await this.getDb();
    const candidates = [...new Set([key, key.replace(/^www\./, '')])];
    let slug = '';
    for (const candidate of candidates) {
      const q = query(
        collection(db, this.collectionName),
        where('customDomain.domain', '==', candidate),
        where('customDomain.status', 'in', ['verified', 'live']),
        where('status', '==', 'published')
      );
      const snapshot = await this.withTimeout(getDocs(q), 15000, 'getBusinessByHost');
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        slug = (d.data() as { slug?: string }).slug ?? '';
        if (slug) break;
      }
    }

    this.hostSlugCache.set(key, {
      slug,
      expiresAt: Date.now() + BusinessService.HOST_CACHE_TTL_MS,
    });
    return slug ? this.getBusinessBySlug(slug) : null;
  }

  async createBusiness(business: Omit<Business, 'id' | 'ownerId'>): Promise<string> {
    const functions = await this.getFunctionsInstance();
    const createFn = httpsCallable<
      Omit<Business, 'id' | 'ownerId'>,
      { id?: string; error?: string }
    >(functions, 'createBusinessServerFn');

    try {
      const result = await createFn(business as any);
      if (result.data.error) {
        throw new Error(result.data.error);
      }
      return result.data.id!;
    } catch (err: any) {
      if (err?.code === 'resource-exhausted') {
        throw new Error(err.message);
      }
      if (err?.code === 'failed-precondition') {
        throw new Error(err.message);
      }
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
    const db = await this.getDb();
    const docRef = doc(db, this.collectionName, id);

    const snapshot = await this.withTimeout(getDoc(docRef), 15000, 'updateBusiness.read');
    if (!snapshot.exists()) {
      throw new Error('Business not found');
    }

    const businessData = snapshot.data() as Business;

    if (!this.isAdmin() && businessData.ownerId !== this.getCurrentUserId()) {
      throw new Error('You do not have permission to update this business');
    }

    const cleanData: DocumentData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'ownerId') {
        cleanData[key] = value;
      }
    }

    // Publishing must go through publishBusiness() — block direct status changes
    if (cleanData['status'] === 'published') {
      delete cleanData['status'];
    }
    // publishedAt is set exclusively by the server-enforced publish operation
    delete cleanData['publishedAt'];

    cleanData['updatedAt'] = Timestamp.now();

    try {
      await this.withTimeout(updateDoc(docRef, cleanData), 15000, 'updateBusiness');
    } catch (err: any) {
      console.error('[BusinessService] updateBusiness error:', err);
      if (err?.message?.includes('NOT_FOUND') || err?.message?.includes('Could not reach')) {
        throw new Error('Firestore database is not available. Please create a Firestore database in your Firebase Console.');
      }
      throw err;
    }
  }

  async publishBusiness(businessId: string): Promise<void> {
    const functions = await this.getFunctionsInstance();
    const publishFn = httpsCallable<
      { businessId: string },
      { success?: boolean; error?: string }
    >(functions, 'publishBusinessServerFn');

    try {
      const result = await publishFn({ businessId });
      if (result.data.error) {
        throw new Error(result.data.error);
      }
    } catch (err: any) {
      if (err?.code === 'resource-exhausted') {
        throw new Error(err.message);
      }
      if (err?.code === 'failed-precondition') {
        throw new Error(err.message);
      }
      throw err;
    }
  }

  async unpublishBusiness(businessId: string): Promise<void> {
    const db = await this.getDb();
    const docRef = doc(db, this.collectionName, businessId);

    const snapshot = await this.withTimeout(getDoc(docRef), 15000, 'unpublishBusiness.read');
    if (!snapshot.exists()) {
      throw new Error('Business not found');
    }

    const businessData = snapshot.data() as Business;
    if (!this.isAdmin() && businessData.ownerId !== this.getCurrentUserId()) {
      throw new Error('You do not have permission to unpublish this business');
    }

    await this.withTimeout(
      updateDoc(docRef, {
        status: 'draft',
        updatedAt: Timestamp.now(),
      }),
      15000,
      'unpublishBusiness'
    );
  }

  async deleteBusiness(id: string): Promise<void> {
    const db = await this.getDb();
    const docRef = doc(db, this.collectionName, id);

    const snapshot = await this.withTimeout(getDoc(docRef), 15000, 'deleteBusiness.read');
    if (!snapshot.exists()) {
      throw new Error('Business not found');
    }

    const businessData = snapshot.data() as Business;

    if (!this.isAdmin() && businessData.ownerId !== this.getCurrentUserId()) {
      throw new Error('You do not have permission to delete this business');
    }

    await this.withTimeout(deleteDoc(docRef), 15000, 'deleteBusiness');
  }

  async duplicateBusiness(business: Business): Promise<string> {
    const baseSlug = this.generateSlug(business.businessName);
    const slug = await this.generateUniqueSlug(baseSlug);

    const duplicateData = {
      ownerId: this.getCurrentUserId(),
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
      status: 'draft' as const,
      themeId: business.themeId,
      themeOptions: business.themeOptions
        ? { ...business.themeOptions }
        : undefined,
    };

    return this.createBusiness(duplicateData);
  }

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    const db = await this.getDb();
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

  async connectCustomDomain(businessId: string, domain: string): Promise<CustomDomainConfig> {
    const functions = await this.getFunctionsInstance();
    const connectFn = httpsCallable<
      { businessId: string; domain: string },
      { domain?: string; status?: string; verificationToken?: string; error?: string }
    >(functions, 'connectCustomDomainServerFn');

    try {
      const result = await connectFn({ businessId, domain });
      if (result.data.error) {
        throw new Error(result.data.error);
      }
      return {
        domain: result.data.domain!,
        status: result.data.status as CustomDomainConfig['status'],
        verificationToken: result.data.verificationToken,
        verifiedAt: undefined,
      };
    } catch (err: any) {
      if (err?.code === 'resource-exhausted') {
        throw new Error(err.message);
      }
      if (err?.code === 'already-exists') {
        throw new Error(err.message);
      }
      throw err;
    }
  }

  async verifyCustomDomain(businessId: string): Promise<CustomDomainConfig> {
    const functions = await this.getFunctionsInstance();
    const verifyFn = httpsCallable<{ businessId: string; domain: string }, { success: boolean; status?: string; error?: string; errorCode?: string }>(
      functions,
      'verifyCustomDomainFn'
    );

    const business = await this.getBusinessById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    const customDomain = business.customDomain;
    if (!customDomain) {
      throw new Error('No custom domain configured for this business');
    }

    if (customDomain.status === 'verified') {
      throw new Error('Domain is already verified');
    }

    if (customDomain.status !== 'pending') {
      throw new Error('Domain is not in pending state');
    }

    const domain = customDomain.domain;
    if (!domain) {
      throw new Error('Invalid domain configuration');
    }

    const result = await verifyFn({ businessId, domain });

    const data = result.data;
    if (!data.success) {
      if (data.errorCode === 'verification-record-not-found') {
        throw new Error(data.error || 'We couldn\'t find the verification record yet. DNS changes can take time to propagate.');
      }
      throw new Error(data.error || 'Verification failed. Please try again.');
    }

    const updatedBusiness = await this.getBusinessById(businessId);
    if (!updatedBusiness || !updatedBusiness.customDomain) {
      throw new Error('Failed to retrieve updated business data');
    }

    return updatedBusiness.customDomain;
  }

  async checkCustomDomainLive(businessId: string): Promise<{ live: boolean; status?: string; message?: string }> {
    const functions = await this.getFunctionsInstance();
    const checkFn = httpsCallable<
      { businessId: string },
      { live: boolean; status?: string; message?: string }
    >(functions, 'checkCustomDomainLiveFn');

    const result = await checkFn({ businessId });
    return result.data;
  }

  async disconnectCustomDomain(businessId: string): Promise<void> {
    const business = await this.getBusinessById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    const customDomain = business.customDomain;
    if (!customDomain) {
      return;
    }

    const disabledConfig: CustomDomainConfig = {
      domain: customDomain.domain,
      status: 'disabled',
      verificationToken: undefined,
      verifiedAt: customDomain.verifiedAt,
    };

    await this.updateBusiness(businessId, {
      customDomain: disabledConfig,
    });
  }

  getCanonicalUrl(business: Business, platformOrigin: string): string {
    if (
      business.customDomain?.status === 'verified' ||
      business.customDomain?.status === 'live'
    ) {
      const protocol = platformOrigin.startsWith('https://') ? 'https://' : 'http://';
      return `${protocol}${business.customDomain.domain}`;
    }
    return `${platformOrigin}/demo/${business.slug}`;
  }
}