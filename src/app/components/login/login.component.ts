import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  loading = signal(false);
  error = signal('');
  unauthorized = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.unauthorized.set(false);

    try {
      const result = await this.authService.loginWithGoogle();

      if (!result.authorized) {
        this.unauthorized.set(true);
        return;
      }

      this.router.navigate(['/admin']);
    } catch (err: unknown) {
      console.error('[Auth] Google Sign-In failed:', err);

      // Extract the best available error info
      const errObj = err as any;
      const code: string = errObj?.code ?? errObj?.name ?? 'unknown';
      const message: string = errObj?.message ?? String(err);

      const errorMessages: Record<string, string> = {
        'auth/popup-blocked': 'Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.',
        'auth/popup-closed-by-user': 'Sign-in cancelled.',
        'auth/network-request-failed': 'Network error. Please check your connection and try again.',
        'auth/unauthorized-domain': 'This domain is not authorized for Google Sign-In. Check Firebase authorized domains.',
        'auth/operation-not-allowed': 'Google Sign-In is not enabled in your Firebase project. Enable it in Firebase Console → Authentication → Sign-in providers → Google.',
        'auth/invalid-api-key': 'Firebase configuration is invalid. Check your Firebase config values.',
        'auth/api-key-not-valid': 'Firebase API key is not valid. Check your Firebase configuration.',
        'auth/invalid-app-id': 'Firebase App ID is not valid. Check your Firebase configuration.',
        'auth/missing-app-credential': 'Firebase is not properly configured. Check your Firebase config values.',
        'auth/argument-error': 'Firebase configuration error. Check your Firebase config values.',
        'auth/internal-error': 'Firebase internal error. This may indicate a configuration issue. Check Firebase Console settings.',
        'auth/popup-expired': 'The sign-in popup expired. Please try again.',
        'auth/cancelled-popup-request': 'Sign-in cancelled.',
        'auth/no-auth-event': 'No authentication event received. Google Sign-In may not be enabled in your Firebase project.',
        'auth/web-storage-unsupported': 'Web storage is not supported. Please enable cookies in your browser.',
      };

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User cancelled — don't show error
        return;
      }

      this.error.set(
        errorMessages[code] ?? `Sign-in failed. Error: ${code} — ${message}`
      );
    } finally {
      this.loading.set(false);
    }
  }
}
