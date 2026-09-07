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
  writeBatch,
} from 'firebase/firestore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AuthService } from './auth.service';
import { Business, CustomDomainConfig } from '../models/business.model';
import {
  normalizeDomain,
  isValidDomainHostname,
  generateVerificationToken,
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

  constructor(private authService: AuthService) {
    // Do NOT initialize Firestore here — Firebase may not be ready yet.
    // Use lazy init via getDb().
  }

  /**
   * Lazily initialize and return the Cloud Functions instance.
   */
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
  private async getDb() {
    if (this.db && this.dbInitialized) {
      return this.db;
    }

    // AuthService kicks off Firebase app initialization asynchronously from
    // its own constructor. Without waiting for it here, a call to getApps()
    // right after injection can run before the app has actually been
    // created — this reliably loses that race during SSR, and can flake in
    // the browser too, since nothing else guarantees the ordering.
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

  async getBusinesses(): Promise<Business[]> {
    this.loading.set(true);
    try {
      const db = await this.getDb();
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

  /** Short-lived host → slug cache so custom-domain requests don't pay a
   *  Firestore read on every navigation. */
  private hostSlugCache = new Map<string, { slug: string; expiresAt: number }>();
  private static readonly HOST_CACHE_TTL_MS = 60_000;

  /**
   * Resolve the published business serving a custom-domain host (used by
   * host-based demo routing — the root '/' of a verified/live custom domain
   * renders the owning business' demo). Only businesses whose custom domain
   * is ownership-verified ('verified') or confirmed live ('live') AND whose
   * status is 'published' are ever resolved this way.
   */
  async getBusinessByHost(host: string): Promise<Business | null> {
    const key = normalizeHostname(host);
    if (!key || isPlatformHost(key)) return null;

    const cached = this.hostSlugCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.slug ? this.getBusinessBySlug(cached.slug) : null;
    }

    const db = await this.getDb();
    // Exact match first, then the www-less variant (so a domain connected as
    // "example.com" also answers on "www.example.com" and vice versa).
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

  async createBusiness(business: Business): Promise<string> {
    const db = await this.getDb();
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

    if (business.status === 'published') {
      dataToSave['publishedAt'] = now;
    }

    if (business.logoUrl) {
      dataToSave['logoUrl'] = business.logoUrl;
    }
    if (business.images && business.images.length > 0) {
      dataToSave['images'] = business.images;
    }
    if (business.themeId) {
      dataToSave['themeId'] = business.themeId;
    }
    if (business.themeOptions && Object.keys(business.themeOptions).length > 0) {
      dataToSave['themeOptions'] = business.themeOptions;
    }
    // ---- Optional Phase 3 advanced features (only when present) ----
    if (business.testimonials && business.testimonials.length > 0) {
      dataToSave['testimonials'] = business.testimonials;
    }
    if (business.faqs && business.faqs.length > 0) {
      dataToSave['faqs'] = business.faqs;
    }
    if (business.socialLinks && Object.values(business.socialLinks).some((v) => v)) {
      dataToSave['socialLinks'] = business.socialLinks;
    }
    if (business.primaryCta && business.primaryCta.enabled && business.primaryCta.label) {
      dataToSave['primaryCta'] = business.primaryCta;
    }
    if (business.announcement && business.announcement.enabled && business.announcement.text) {
      dataToSave['announcement'] = business.announcement;
    }

    try {
      const docRef = await this.withTimeout(
        addDoc(collection(db, this.collectionName), dataToSave),
        15000,
        'createBusiness'
      );
      return docRef.id;
    } catch (err: any) {
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

    const cleanData: DocumentData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id') {
        cleanData[key] = value;
      }
    }
    // Publishing foundation: when a business transitions to 'published' and
    // has no publish date yet, stamp it (covers every publish path — builder
    // save, dashboard toggle, API callers). Kept on unpublish as history.
    if (cleanData['status'] === 'published' && cleanData['publishedAt'] === undefined) {
      try {
        const existing = await this.withTimeout(
          getDoc(docRef),
          15000,
          'updateBusiness.readForPublish'
        );
        if (!existing.exists() || !(existing.data() as DocumentData)?.['publishedAt']) {
          cleanData['publishedAt'] = Timestamp.now();
        }
      } catch (err) {
        console.warn('[BusinessService] Could not read existing publishedAt, stamping now:', err);
        cleanData['publishedAt'] = Timestamp.now();
      }
    }

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

  async deleteBusiness(id: string): Promise<void> {
    const db = await this.getDb();
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
      themeId: business.themeId,
      themeOptions: business.themeOptions
        ? { ...business.themeOptions }
        : undefined,
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

  // ============ CUSTOM DOMAIN METHODS ============

  /**
   * Check if a custom domain is already claimed by another business.
   * Returns the business ID if claimed, null if available.
   */
  async checkDomainConflict(domain: string, excludeBusinessId?: string): Promise<string | null> {
    const normalized = normalizeDomain(domain);
    if (!normalized || !isValidDomainHostname(normalized)) {
      throw new Error('Invalid domain format');
    }

    const db = await this.getDb();
    const q = query(
      collection(db, this.collectionName),
      where('customDomain.domain', '==', normalized)
    );
    const snapshot = await this.withTimeout(getDocs(q), 15000, 'checkDomainConflict');
    
    if (snapshot.empty) return null;
    
    const existingBusiness = snapshot.docs[0];
    if (excludeBusinessId && existingBusiness.id === excludeBusinessId) return null;
    
    return existingBusiness.id;
  }

  /**
   * Connect a custom domain to a business.
   * Validates domain, checks for conflicts, and generates verification token.
   */
  async connectCustomDomain(businessId: string, domain: string): Promise<CustomDomainConfig> {
    const normalized = normalizeDomain(domain);
    if (!normalized || !isValidDomainHostname(normalized)) {
      throw new Error('Invalid domain format. Please enter a valid hostname (e.g., example.com).');
    }

    // Check for conflicts with other businesses
    const conflictId = await this.checkDomainConflict(normalized, businessId);
    if (conflictId) {
      throw new Error('This domain is already connected to another business.');
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const now = Timestamp.now();

    const customDomainConfig: CustomDomainConfig = {
      domain: normalized,
      status: 'pending',
      verificationToken,
      verifiedAt: undefined,
    };

    await this.updateBusiness(businessId, {
      customDomain: customDomainConfig,
    });

    return customDomainConfig;
  }

  /**
   * Verify a custom domain by calling the server-side Cloud Function.
   * The function performs secure DNS TXT record verification.
   */
  async verifyCustomDomain(businessId: string): Promise<CustomDomainConfig> {
    const functions = await this.getFunctionsInstance();
    const verifyFn = httpsCallable<{ businessId: string; domain: string }, { success: boolean; status?: string; error?: string; errorCode?: string }>(
      functions,
      'verifyCustomDomainFn'
    );

    // Get the business first to extract the domain
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

    // Call the Cloud Function
    const result = await verifyFn({ businessId, domain });

    const data = result.data;
    if (!data.success) {
      // Handle specific error codes
      if (data.errorCode === 'verification-record-not-found') {
        throw new Error(data.error || 'We couldn\'t find the verification record yet. DNS changes can take time to propagate.');
      }
      throw new Error(data.error || 'Verification failed. Please try again.');
    }

    // Refresh business data to get updated customDomain
    const updatedBusiness = await this.getBusinessById(businessId);
    if (!updatedBusiness || !updatedBusiness.customDomain) {
      throw new Error('Failed to retrieve updated business data');
    }

    return updatedBusiness.customDomain;
  }

  /**
   * Ask the server to probe a verified custom domain over HTTPS and mark it
   * 'live' when the application demonstrably serves the business' published
   * demo on that domain. See the checkCustomDomainLiveFn Cloud Function.
   */
  async checkCustomDomainLive(businessId: string): Promise<{ live: boolean; status?: string; message?: string }> {
    const functions = await this.getFunctionsInstance();
    const checkFn = httpsCallable<
      { businessId: string },
      { live: boolean; status?: string; message?: string }
    >(functions, 'checkCustomDomainLiveFn');

    const result = await checkFn({ businessId });
    return result.data;
  }

  /**
   * Disconnect a custom domain from a business.
   * Sets status to 'disabled' and clears verification token.
   */
  async disconnectCustomDomain(businessId: string): Promise<void> {
    const business = await this.getBusinessById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    const customDomain = business.customDomain;
    if (!customDomain) {
      return; // Already disconnected
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

  /**
   * Get the canonical public URL for a business.
   * Uses custom domain if verified, otherwise falls back to platform demo URL.
   */
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