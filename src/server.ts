import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getFirebaseConfig } from './app/environment/environment';
import {
  isPlatformHost,
  normalizeHostname,
} from './app/components/demo/shared/domain-utils';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// ---------------------------------------------------------------------------
// Custom-domain host routing (server side).
//
// Firebase Hosting serves this app on a custom domain only after the domain
// is manually added to the Hosting site (console/CLI) and its DNS pointed at
// Firebase Hosting. There is no automatic per-business domain attachment, so
// a request to https://customer-domain.com/ arrives here (hosting rewrites
// everything to the ssr function) with the original Host header intact. This
// middleware resolves that Host to the business whose custom domain is
// ownership-verified ('verified') or confirmed live ('live') and published,
// then rewrites the request to that business' /demo/:slug route so the demo
// is server-rendered at the clean domain root.
//
// Non-custom hosts (the platform's own domains, localhost, preview hosts)
// and already-demo paths pass straight through unchanged. Registered after
// express.static so static assets on custom domains are still served from
// disk when the server runs standalone (with Firebase Hosting in front,
// static files never reach this function).
// ---------------------------------------------------------------------------
const hostSlugCache = new Map<string, { slug: string; expiresAt: number }>();
const HOST_CACHE_TTL_MS = 60_000;

/** Resolve the published business slug serving a custom-domain host. */
async function resolveSlugForHost(host: string): Promise<string | null> {
  const key = normalizeHostname(host);
  if (!key || isPlatformHost(key)) return null;

  const cached = hostSlugCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.slug || null;

  let slug = '';
  try {
    if (getApps().length === 0) {
      initializeApp(await getFirebaseConfig());
    }
    const db = getFirestore(getApps()[0]);
    // Exact match first, then the www-less variant.
    const candidates = [...new Set([key, key.replace(/^www\./, '')])];
    for (const candidate of candidates) {
      const q = query(
        collection(db, 'businesses'),
        where('customDomain.domain', '==', candidate),
        where('customDomain.status', 'in', ['verified', 'live']),
        where('status', '==', 'published')
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        slug = (snapshot.docs[0].data() as { slug?: string }).slug ?? '';
        if (slug) break;
      }
    }
  } catch (err) {
    // Never break requests because the lookup failed — fall through to
    // normal Angular routing.
    console.error('[SSR] Custom-domain host lookup failed:', err);
  }

  hostSlugCache.set(key, { slug, expiresAt: Date.now() + HOST_CACHE_TTL_MS });
  return slug || null;
}

/** Rewrite custom-domain requests to the owning business' demo route. */
app.use(async (req, _res, next) => {
  const host = req.headers.host ?? '';
  const path = req.url ?? '/';
  if (
    isPlatformHost(host) ||
    path === '/env-config.json' ||
    path.startsWith('/demo/') ||
    path === '/demo'
  ) {
    next();
    return;
  }

  try {
    const slug = await resolveSlugForHost(host);
    if (slug) {
      const queryIndex = req.url!.indexOf('?');
      const queryString = queryIndex >= 0 ? req.url!.slice(queryIndex) : '';
      req.url = `/demo/${slug}${queryString}`;
    }
  } catch (err) {
    console.error('[SSR] Custom-domain rewrite failed:', err);
  }
  next();
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);