import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirebaseConfig } from '../environment/environment';

const ALLOWED_EMAILS = ['gsanketh7121@gmail.com'];

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private app!: FirebaseApp;
  private auth!: ReturnType<typeof getAuth>;
  private unsubscribe!: () => void;

  currentUser = signal<User | null>(null);
  loading = signal(true);
  isAuthenticated = computed(() => this.currentUser() !== null);
  isAuthorized = computed(() => {
    const user = this.currentUser();
    return user !== null && ALLOWED_EMAILS.includes(user.email ?? '');
  });

  constructor() {
    this.initFirebase();
  }

  private async initFirebase(): Promise<void> {
    try {
      const config = await getFirebaseConfig();
      console.log('[Auth] Firebase config loaded. Initializing...');
      this.app = initializeApp(config);
      this.auth = getAuth(this.app);

      this.unsubscribe = onAuthStateChanged(this.auth, (user) => {
        this.currentUser.set(user);
        this.loading.set(false);
      });

      console.log('[Auth] Firebase app initialized: true');
      console.log('[Auth] Auth instance initialized: true');
    } catch (err) {
      console.error('[Auth] Firebase initialization failed:', err);
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  async loginWithGoogle(): Promise<{ authorized: boolean }> {
    console.log('[Auth] Attempting Google Sign-In...');
    console.log('[Auth] Firebase app initialized:', !!this.app);
    console.log('[Auth] Auth instance initialized:', !!this.auth);
    if (!this.auth) {
      throw new Error('Firebase Auth is not initialized. Check FIREBASE environment variables.');
    }
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(this.auth, provider);
    console.log('[Auth] Google Sign-In successful. Email:', credential.user.email);
    const email = credential.user.email ?? '';

    if (!ALLOWED_EMAILS.includes(email)) {
      await signOut(this.auth);
      return { authorized: false };
    }

    return { authorized: true };
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  getFirebaseAuth() {
    return this.auth;
  }
}
