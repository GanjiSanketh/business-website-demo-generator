import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { BusinessService } from '../services/business.service';
import { isPlatformHost, normalizeHostname } from '../components/demo/shared/domain-utils';

/**
 * Root-route ('/') guard for custom-domain serving.
 *
 * On the platform's own hosts the root keeps its historical behavior
 * (redirect to /admin). When the root is reached through a verified custom
 * domain, the demo page renders instead and resolves the business from the
 * Host header (server-side the SSR middleware in src/server.ts already
 * rewrote the request to /demo/:slug; the client lands here at '/' after
 * hydration and must NOT be redirected to /admin).
 *
 * Unknown hosts (e.g. local/preview environments) fall back to the /admin
 * redirect so nothing else in the app changes.
 */
export const hostDemoGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const businessService = inject(BusinessService);

  // Server-side rendering never reaches the '/' route for custom domains
  // (the SSR middleware rewrites first), so an empty host simply means the
  // normal platform flow.
  const host =
    typeof window !== 'undefined' ? normalizeHostname(window.location.hostname) : '';
  if (!host || isPlatformHost(host)) {
    return router.createUrlTree(['/admin']);
  }

  // A failed host lookup (missing Firestore composite index, transient
  // Firestore error, rules denial, network failure) must never reject the
  // root navigation and blank the page — fall back to the historical /admin
  // redirect exactly like an unknown host. Valid live custom domains still
  // resolve normally and continue to render the demo.
  try {
    const business = await businessService.getBusinessByHost(host);
    return business ? true : router.createUrlTree(['/admin']);
  } catch (err) {
    console.error(
      '[HostDemoGuard] Custom-domain lookup failed, redirecting to /admin:',
      err
    );
    return router.createUrlTree(['/admin']);
  }
};