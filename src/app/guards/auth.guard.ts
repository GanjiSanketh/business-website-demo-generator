import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const userService = inject(UserService);
  const router = inject(Router);

  while (authService.loading()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (authService.isAuthenticated()) {
    try {
      await userService.loadProfile();
      return true;
    } catch (err) {
      console.error('[AuthGuard] Failed to load user profile:', err);
      await authService.logout();
    }
  }

  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const userService = inject(UserService);
  const router = inject(Router);

  while (authService.loading()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (authService.isAuthenticated() && userService.isAdmin()) {
    return true;
  }

  if (authService.isAuthenticated()) {
    await authService.logout();
  }

  router.navigate(['/login']);
  return false;
};