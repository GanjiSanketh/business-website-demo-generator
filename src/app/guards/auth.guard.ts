import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for initial auth state to load
  while (authService.loading()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (authService.isAuthorized()) {
    return true;
  }

  // If authenticated but not authorized, sign out
  if (authService.isAuthenticated()) {
    await authService.logout();
  }

  router.navigate(['/login']);
  return false;
};
