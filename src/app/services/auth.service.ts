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
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private app!: FirebaseApp;
  private auth!: ReturnType<typeof getAuth>;
  private unsubscribe!: () => void;

  currentUser = signal<User | null>(null);
  loading = signal(true);
  isAuthenticated = computed(() => this.currentUser() !== null);

  readonly ready: Promise<void>;

  constructor(private userService: UserService) {
    this.ready = this.initFirebase();
  }

  private async initFirebase(): Promise<void> {
    try {
      const config = await getFirebaseConfig();
      this.app = initializeApp(config);
      this.auth = getAuth(this.app);

      this.unsubscribe = onAuthStateChanged(this.auth, async (user) => {
        this.currentUser.set(user);
        this.loading.set(false);

        if (user) {
          await this.userService.loadProfile();
        }
      });
    } catch (err) {
      console.error('[Auth] Firebase initialization failed:', err);
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  async loginWithGoogle(): Promise<{ authorized: boolean }> {
    if (!this.auth) {
      throw new Error('Firebase Auth is not initialized. Check FIREBASE environment variables.');
    }
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(this.auth, provider);

    return { authorized: true };
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  getFirebaseAuth() {
    return this.auth;
  }
}