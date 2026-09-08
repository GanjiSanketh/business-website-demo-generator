import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { BusinessService } from '../services/business.service';

export const businessOwnershipGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const userService = inject(UserService);
  const businessService = inject(BusinessService);
  const router = inject(Router);

  while (authService.loading()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const businessId = route.paramMap.get('id');
  if (!businessId) {
    router.navigate(['/admin']);
    return false;
  }

  try {
    const business = await businessService.getBusinessById(businessId);
    if (!business) {
      router.navigate(['/admin']);
      return false;
    }

    if (userService.isAdmin() || business.ownerId === userService.getProfile()?.uid) {
      return true;
    }
  } catch (err) {
    console.error('[BusinessOwnershipGuard] Failed to check ownership:', err);
  }

  router.navigate(['/admin']);
  return false;
};