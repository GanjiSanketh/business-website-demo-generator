import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { AuthService } from './auth.service';
import {
  UserProfile,
  UserRole,
  PlanId,
  SubscriptionStatus,
  DEFAULT_USER_PROFILE,
  UserSubscription,
} from '../models/user.model';
import { getFirebaseConfig } from '../environment/environment';

@Injectable({ providedIn: 'root' })
export class UserService implements OnDestroy {
  private db: ReturnType<typeof getFirestore> | undefined;
  private dbInitialized = false;

  profile = signal<UserProfile | null>(null);
  loading = signal(true);

  readonly isAdmin = computed(() => this.profile()?.role === 'admin');
  readonly currentPlan = computed(() => this.profile()?.plan ?? 'free');
  readonly subscriptionStatus = computed(() => this.profile()?.subscriptionStatus ?? 'inactive');

  constructor(private authService: AuthService) {}

  ngOnDestroy(): void {}

  private async getDb() {
    if (this.db && this.dbInitialized) {
      return this.db;
    }

    await this.authService.ready;

    try {
      const apps = getApps();
      if (apps.length === 0) {
        throw new Error('Firebase is not initialized');
      }
      this.db = getFirestore(apps[0]);
      this.dbInitialized = true;
      return this.db;
    } catch (err) {
      console.error('[UserService] Failed to initialize Firestore:', err);
      throw new Error('Firestore is not initialized. Please refresh and try again.');
    }
  }

  async loadProfile(): Promise<UserProfile | null> {
    this.loading.set(true);
    try {
      const user = this.authService.currentUser();
      if (!user) {
        this.profile.set(null);
        return null;
      }

      const db = await this.getDb();
      const profileRef = doc(db, 'users', user.uid);
      const snapshot = await getDoc(profileRef);

      if (!snapshot.exists()) {
        const newProfile = await this.createProfile(user);
        this.profile.set(newProfile);
        return newProfile;
      }

      const data = snapshot.data() as UserProfile;
      this.profile.set(data);
      return data;
    } catch (err) {
      console.error('[UserService] Failed to load profile:', err);
      this.profile.set(null);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  private async createProfile(user: { uid: string; email: string | null; displayName: string | null; photoURL?: string }): Promise<UserProfile> {
    const db = await this.getDb();
    const now = Timestamp.now();

    const email = user.email ?? '';
    const isLegacyAdmin = email === 'gsanketh7121@gmail.com';
    const role: UserRole = isLegacyAdmin ? 'admin' : 'user';

    const profile: UserProfile = {
      uid: user.uid,
      email,
      displayName: user.displayName || email,
      photoURL: user.photoURL,
      role,
      plan: 'free',
      subscriptionStatus: 'active',
      createdAt: now,
      updatedAt: now,
      subscription: {
        plan: 'free',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: undefined,
        cancelAtPeriodEnd: false,
      },
    };

    await setDoc(doc(db, 'users', user.uid), profile);
    return profile;
  }

  async updateSafeFields(updates: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>): Promise<void> {
    const profile = this.profile();
    if (!profile) return;

    const db = await this.getDb();
    const cleanUpdates: DocumentData = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    cleanUpdates['updatedAt'] = Timestamp.now();

    await updateDoc(doc(db, 'users', profile.uid), cleanUpdates);
    this.profile.set({ ...profile, ...cleanUpdates });
  }

  async updateSubscription(subscription: UserSubscription): Promise<void> {
    const profile = this.profile();
    if (!profile) return;

    const db = await this.getDb();
    const now = Timestamp.now();

    await updateDoc(doc(db, 'users', profile.uid), {
      subscription,
      plan: subscription.plan,
      subscriptionStatus: subscription.status,
      updatedAt: now,
    });

    this.profile.set({
      ...profile,
      subscription,
      plan: subscription.plan,
      subscriptionStatus: subscription.status,
      updatedAt: now,
    });
  }

  async updateRole(role: UserRole): Promise<void> {
    const profile = this.profile();
    if (!profile) return;

    const db = await this.getDb();
    await updateDoc(doc(db, 'users', profile.uid), {
      role,
      updatedAt: Timestamp.now(),
    });
    this.profile.set({ ...profile, role, updatedAt: Timestamp.now() });
  }

  getProfile(): UserProfile | null {
    return this.profile();
  }

  getRole(): UserRole {
    return this.profile()?.role ?? 'user';
  }

  getPlan(): PlanId {
    return this.profile()?.plan ?? 'free';
  }

  isProfileLoading(): boolean {
    return this.loading();
  }
}