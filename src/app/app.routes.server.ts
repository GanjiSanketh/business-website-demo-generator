import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // '/' must be server-rendered so custom-domain hosts get SSR'd demo
    // content (hostDemoGuard then either renders the host-resolved demo or
    // redirects to /admin as before).
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: 'demo/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client,
  },
  {
    path: 'login',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
