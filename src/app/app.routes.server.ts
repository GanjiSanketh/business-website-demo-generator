import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
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
