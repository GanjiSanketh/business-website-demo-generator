# Business Website Demo Generator

An internal tool for authorized admins to create, customize, and publish personalized business website demos. The application provides a complete workflow: select a business category, choose a template, customize themes, add business information and media, preview in real time, publish, and optionally connect a custom domain.

---

## Technology Stack

**Frontend**
- **Angular 21** — Standalone components, signals, zoneless change detection
- **TypeScript 5.9** — Type-safe development
- **Angular SSR** — Server-side rendering via Firebase Cloud Functions
- **Angular Hydration** — Client hydration with event replay
- **Bootstrap 5** + **Bootstrap Icons** — UI components and icon library
- **html-to-image** — Thumbnail/screenshot generation for template previews
- **Vitest** — Unit testing

**Backend (Firebase)**
- **Firebase Authentication** — Google popup sign-in with email allowlist authorization
- **Cloud Firestore** — Document database (business data, custom domain config)
- **Firebase Storage** — File uploads (logos, images, favicons, social images)
- **Firebase Cloud Functions v2** — SSR handler, custom domain verification, liveness probing
- **Firebase Hosting** — Static asset serving + SSR rewrites
- **Node.js 20** — Functions runtime

---

## Architecture

```
Frontend (Angular 21)
├── Standalone Components
├── Client Rendering + SSR + Hydration
└── Zoneless + Event Replay

Backend (Firebase)
├── Firebase Auth (Google + Allowlist)
├── Firestore (Businesses, Custom Domains)
├── Storage (Media Assets)
├── Cloud Functions v2 (SSR, Domain Verification, Liveness)
└── Firebase Hosting (Static + SSR Rewrites)
```

### SSR Architecture

```
Firebase Hosting
    ↓
Static Assets (served directly)
    ↓
Application Routes (/**)
    ↓
Cloud Function: `ssr` (v2, Node 20, pinned tag)
    ↓
Angular SSR (server.mjs)
    ↓
Rendered HTML → Client
```

- Static assets (`/assets/**`, `env-config.json`, etc.) are served by Firebase Hosting
- All other requests are rewritten to the `ssr` Cloud Function
- The SSR function executes the Angular server bundle (`server.mjs`)
- Hydration takes over on the client with event replay
- Existing client-rendered routes remain supported

---

## Authentication

- **Google Popup Authentication** — Single sign-in method via `signInWithPopup`
- **Authorized Admin Access** — Email allowlist (`gsanketh7121@gmail.com`) enforced in:
  - Client `AuthService` (guards, UI)
  - Cloud Functions `checkAuthorization` (callable functions)
  - Firestore Security Rules (`request.auth.token.email`)
- **No Email/Password** — Not implemented or used
- The allowlist must stay synchronized across:
  - `src/app/services/auth.service.ts`
  - `functions/src/auth.ts`
  - `firestore.rules`

---

## Business Categories

Registered in `src/app/components/demo/categories/category.registry.ts`:

| Category ID | Display Name | Schema.org Type |
|-------------|--------------|-----------------|
| `salon` | Salon & Beauty | BeautySalon |
| `restaurant` | Restaurant & Dining | Restaurant |
| `gym` | Gym & Fitness | HealthClub |
| `clothing-store` | Clothing Store | ClothingStore |
| `clinic` | Clinic | MedicalClinic |
| `real-estate` | Real Estate | RealEstateAgent |
| `hotel` | Hotel | Hotel |
| `photography` | Photography | PhotographyBusiness |

Categories are registry-driven — adding a category requires only a registry entry plus templates that declare its `categoryId`.

---

## Website Templates

Registered in `src/app/components/demo/templates/template.registry.ts` (8 templates):

| Template ID | Name | Category | Appearance | Default Theme |
|-------------|------|----------|------------|---------------|
| `salon-01` | Luxury Editorial | salon | light | classic-cream |
| `salon-02` | Modern Boutique | salon | dark | black-gold |
| `restaurant-01` | Fine Dining | restaurant | dark | midnight |
| `restaurant-02` | Modern Café | restaurant | light | warm-minimal |
| `gym-01` | Powerful Dark | gym | dark | power-dark |
| `gym-02` | Modern Fitness | gym | light | fresh-light |
| `clothing-01` | Fashion Editorial | clothing-store | dark | noir-editorial |
| `clothing-02` | Modern Boutique | clothing-store | light | boutique-rose |

Each template declares:
- `supportedThemes` — subset of theme registry it works with
- `defaultThemeId` — fallback when no theme is selected
- `appearance` — `light` or `dark` for picker styling
- `tags` — for future search/filtering

Templates are Angular standalone components registered via `template.init.ts`.

---

## Themes

Theme system in `src/app/components/demo/themes/theme.registry.ts` (31 presets):

**Theme Structure**
- **Visuals** — 20+ CSS custom properties (palette, typography, radii, spacing)
- **Style Options** — Button style (rounded/soft/sharp), Hero style (image/split/centered), Gallery style (editorial/grid/masonry)
- **Per-Template Support** — Templates opt in via `supportedThemes`
- **CSS Generation** — `buildThemeCss()` produces inline custom properties; `themeOptionClasses()` produces modifier classes

**Theme Categories**
- **Salon/General** (4): classic-cream, black-gold, rose-ivory, earthy-beige
- **Restaurant Fine Dining** (3): midnight, ivory-gold, burgundy
- **Restaurant Modern Café** (3): warm-minimal, earthy, contemporary
- **Gym Powerful Dark** (3): power-dark, steel-dark, energy-dark
- **Gym Modern Fitness** (3): fresh-light, clean-slate, vitality-light
- **Clothing Fashion Editorial** (3): noir-editorial, champagne-luxe, monochrome-chic
- **Clothing Modern Boutique** (3): boutique-rose, modern-sand, urban-minimal

Business stores only `themeId` + optional `themeOptions` (style overrides); full palette lives in the registry.

---

## Business Builder

### Create Mode (Wizard)

Four-step wizard (`/admin/business/new`):

1. **Business** — Name, category, contact info, tagline, description
2. **Design** — Template selection, theme selection, style overrides, live preview
3. **Media** — Logo, favicon, social image, gallery images (drag/drop, cover selection)
4. **Review** — Full preview, slug confirmation, SEO settings, publish/save draft

### Edit Mode (Builder Workspace)

Accessed at `/admin/business/:id/edit`. Persistent center-stage preview with four panels:

- **Information** — Business details, contact, hours, SEO, slug
- **Design** — Template gallery (live thumbnails), theme picker, style overrides
- **Content** — Services/Menu, Gallery, Testimonials, FAQs, Social Links, Primary CTA, Announcement
- **Settings** — Custom domain, advanced configuration

**Device Preview** — Desktop (1440px), Tablet (768px), Mobile (390px) with scaled frames

**Dirty-State Protection** — Unsaved changes tracked; `beforeunload` prompt and `CanDeactivate` guard prevent accidental navigation

---

## Advanced Business Features (Phase 3)

All implemented and integrated into templates, builder, and SSR rendering:

| Feature | Model | Builder UI | Template Rendering |
|---------|-------|------------|-------------------|
| Business Hours | `BusinessHours` (7 days, open/close/closed) | Settings panel | Opening hours display + JSON-LD |
| Testimonials | `Testimonial[]` (name, role, quote, rating 1-5, image) | Content → Testimonials | Carousel/grid with stars |
| FAQs | `FAQItem[]` (question, answer) | Content → FAQs | Accordion + FAQPage JSON-LD |
| Social Links | `SocialLinks` (Instagram, Facebook, YouTube, LinkedIn, X) | Content → Social | Icon links in header/footer |
| Primary CTA | `PrimaryCta` (enabled, label, action: phone/whatsapp/url/scroll, value) | Content → CTA | Prominent button with resolved href |
| Announcement Bar | `AnnouncementConfig` (enabled, text, linkText, linkUrl) | Content → Announcement | Top bar with optional link |

**CTA Behavior** (verified in `advanced-features.ts`):
- `phone` → `tel:` link using business phone or override
- `whatsapp` → `https://wa.me/` link using business WhatsApp or override
- `url` → External link (validated HTTPS)
- `scroll` → In-page scroll to section id (validated against known sections)

---

## Publishing

- **Draft** — Default state; not accessible via public demo URLs
- **Published** — Status = `published`; `publishedAt` timestamp set on first publish
- **Public Demo URL** — `https://<platform-host>/demo/<slug>`
  - Slug auto-generated from business name, editable in Settings
  - Only published businesses resolve; drafts return 404
- **Publishing Actions** — "Save Draft" / "Publish" / "Update Website" buttons on Review step and builder top bar

---

## Custom Domains

### Flow

**Step 1 — Connect**  
Admin enters custom domain → normalized, validated, checked for conflicts → `pending` status with cryptographic verification token stored

**Step 2 — Verify Ownership**  
System provides DNS TXT record:
- Host: `_demosite-verification.<domain>`
- Value: `demosite-verification=<token>`

Admin adds TXT record at their DNS provider

**Step 3 — Verify Domain**  
Admin clicks "Verify" → Cloud Function `verifyCustomDomainFn` performs secure DNS TXT lookup:
- Queries `resolveTxt('_demosite-verification.<domain>')`
- Matches exact token
- On success: status → `verified`, token deleted, `verifiedAt` set
- On missing record: returns `pending` with guidance
- Conflicts with other businesses blocked

**Step 4 — Infrastructure Setup (MANUAL)**  
**Firebase does NOT automatically attach arbitrary domains.** The admin must:
1. Add the custom domain in Firebase Console → Hosting → Custom domains
2. Configure required DNS records (A/CNAME) pointing to Firebase Hosting
3. Wait for Hosting provisioning and SSL certificate issuance

**Step 5 — Live Verification**  
Admin clicks "Check Live" → Cloud Function `checkCustomDomainLiveFn` probes `https://<domain>/`:
- DNS resolution → public IP only (private/loopback/CGNAT blocked)
- DNS rebinding protection: connection pinned to validated IP
- HTTPS GET with 10s timeout, 512KB body limit
- Validates:
  - HTTP 200
  - Application marker: `<meta name="application-name" content="Business Demo Generator">`
  - Business demo URL present: `/demo/<slug>`
- On success: status → `live`

### Domain States

| State | Meaning |
|-------|---------|
| `pending` | Connected, TXT record not yet confirmed |
| `verified` | DNS TXT ownership proven. **Not automatically serving** — infrastructure must be configured manually |
| `live` | HTTPS probe confirmed: domain resolves, serves this application, serves the correct published business demo |
| `disabled` | Disconnected by admin |

**Only `live` + `published` businesses are served via custom domains.**

### Host-Based Routing

- Root path `/` on a `verified`/`live` custom domain renders the owning business' demo
- SSR middleware (in `src/server.ts` + `ssr.cjs`) rewrites host-based requests to `/demo/:slug` before Angular runs
- Client-side `hostDemoGuard` keeps hydrated client on `/` for custom domains; redirects to `/admin` on platform hosts

---

## Custom Domain Security

- Domain normalization (strip protocol, paths, query, fragments; lowercase)
- Hostname validation per RFC 1123/952
- Localhost/private IP blocking (10.x, 127.x, 172.16-31.x, 192.168.x, link-local, ULA)
- SSRF protection: DNS resolution validated before connection; connection pinned to validated IP (DNS rebinding guard)
- HTTPS-only probes
- Ownership validation via cryptographic TXT token (not derived from business data)
- Published-business-only serving (verified/live custom domain + published status required)
- Host-based routing protection: platform hosts (Firebase defaults, localhost) never trigger custom domain resolution

---

## Firestore Security

Rules in `firestore.rules`:

```javascript
function isAdmin() {
  return request.auth != null && request.auth.token.email == 'gsanketh7121@gmail.com';
}

match /businesses/{businessId} {
  allow read: if isAdmin() || resource.data.status == 'published';
  allow create, update, delete: if isAdmin();
}
```

- Public (anonymous) read: **published businesses only**
- Admin read: all businesses (including drafts)
- All writes: admin only (protects drafts, publishing state, customDomain sub-document)
- Cloud Functions use Admin SDK and bypass these rules by design

---

## Firestore Indexes

Defined in `firestore.indexes.json`:

1. `slug` ASC + `status` ASC — public demo lookup
2. `customDomain.domain` ASC + `customDomain.status` ASC — host-based resolution
3. `customDomain.domain` ASC + `customDomain.status` ASC + `status` ASC — live domain + published check

Deploy with: `firebase deploy --only firestore:indexes`

---

## Firebase Hosting

Configuration in `firebase.json`:

- **Public directory**: `dist/business-demo-generator/browser`
- **Rewrites**: All non-asset requests → `ssr` Cloud Function (pinned tag)
- **Static assets**: Served directly with long-term caching
- **Deployment order** (enforced by `predeploy`):
  1. `npm run build` (Angular build)
  2. `node scripts/copy-ssr.js` (copy SSR bundle to functions)
  3. `npm --prefix functions run build` (compile Functions TypeScript)
  4. `firebase deploy`

---

## Environment Configuration

**Runtime configuration** (not compile-time `environment.ts`):

```
.env.local
    ↓
node scripts/setup-env.js
    ↓
public/env-config.json (deployed as static asset)
    ↓
src/app/environment/environment.ts → getFirebaseConfig() fetches at runtime
```

**Required `.env.local` keys:**
```
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
```

- Firebase web config loaded at runtime via `fetch('/env-config.json')` (browser) or `fs.readFile` (SSR)
- `environment.ts` is a legacy accessor — returns cached config or empty defaults
- **Never commit `.env.local` or real credentials**

---

## Local Development

```bash
# 1. Install root dependencies
npm install

# 2. Install Functions dependencies
cd functions && npm install && cd ..

# 3. Create .env.local with Firebase config (see Environment Configuration)

# 4. Generate runtime config
node scripts/setup-env.js

# 5. Start dev server (includes SSR)
npm start
# Runs: node --max-old-space-size=4096 ng serve --host 0.0.0.0
# Available at http://localhost:4200

# 6. (Optional) Start Functions emulator for callable functions
cd functions && npm run serve
```

**Note:** The dev server uses Angular's built-in SSR dev server. Callable functions (domain verification, liveness) require the Functions emulator or a deployed project.

---

## Build

```bash
# Production build (Angular + SSR bundle)
npm run build
# Runs: node --max-old-space-size=4096 ng build
# Output: dist/business-demo-generator/browser/ + server/

# Copy SSR bundle to Functions (required before Functions build/deploy)
npm run copy-ssr
# Runs: node scripts/copy-ssr.js
# Copies to functions/app/browser/ and functions/app/server/
# Also copies ssr.cjs bridge to functions/lib/

# Build Functions TypeScript
npm --prefix functions run build
# Runs: tsc
# Output: functions/lib/
```

---

## Testing

```bash
# Run unit tests (Vitest via Angular CLI)
npm test
# Runs: ng test
```

Current test coverage: minimal (app component smoke test only).

---

## Functions Build

```bash
# From project root
npm --prefix functions run build
# Compiles functions/src/*.ts → functions/lib/*.js
# Required before firebase deploy
```

---

## Deployment

**Prerequisites:**
- Firebase CLI: `npm i -g firebase-tools`
- Authenticated: `firebase login`
- Project selected: `firebase use <project-id>`
- Real Firebase project with:
  - Authentication → Google provider enabled
  - Firestore database created
  - Storage bucket created
  - Cloud Functions v2 enabled (billing required)
  - Hosting enabled
  - Appropriate IAM permissions

**Deploy Command:**
```bash
npm run deploy
# Runs: npm run build && npm run copy-ssr && firebase deploy
# Deploys: Hosting + Functions + Firestore rules + Firestore indexes
```

**Deployment Order** (enforced by `firebase.json` predeploy):
1. Angular build (`npm run build`)
2. SSR copy (`node scripts/copy-ssr.js`)
3. Functions TypeScript build (`npm --prefix functions run build`)
4. Firebase deploy (Hosting, Functions, Firestore rules, indexes)

**Note:** Deployment validation requiring Firebase credentials must be performed in a real authorized environment. This README documents the configured process; it does not confirm a successful production deployment has occurred.

---

## Project Structure

```
business-demo-generator/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── login/                    # Google sign-in page
│   │   │   ├── admin/
│   │   │   │   ├── layout/               # Admin shell (sidebar, header)
│   │   │   │   ├── dashboard/            # Business list, stats, actions
│   │   │   │   ├── business-form/        # Create/Edit wizard + builder
│   │   │   │   └── screenshot-dialog/    # Thumbnail generation modal
│   │   │   └── demo/
│   │   │       ├── demo-page/            # SSR/CSR demo route handler
│   │   │       ├── templates/            # 8 template components
│   │   │       ├── themes/               # Theme registry + CSS generation
│   │   │       ├── categories/           # Category registry
│   │   │       └── shared/               # Domain utils, advanced features
│   │   ├── services/
│   │   │   ├── auth.service.ts           # Firebase Auth + allowlist
│   │   │   ├── business.service.ts       # Firestore CRUD + custom domains
│   │   │   ├── storage.service.ts        # Firebase Storage uploads
│   │   │   └── screenshot.service.ts     # html-to-image thumbnails
│   │   ├── guards/
│   │   │   ├── auth.guard.ts             # Admin route protection
│   │   │   ├── host-demo.guard.ts        # Custom domain root routing
│   │   │   └── business-form.guard.ts    # Dirty-state CanDeactivate
│   │   ├── models/
│   │   │   └── business.model.ts         # Business, CustomDomain, Phase 3 types
│   │   ├── environment/
│   │   │   └── environment.ts            # Runtime Firebase config loader
│   │   ├── app.routes.ts                 # Route definitions
│   │   ├── app.config.ts                 # Client providers (hydration, replay)
│   │   └── app.config.server.ts          # SSR providers
│   ├── server.ts                         # Express + Angular SSR entry
│   ├── main.ts                           # Client bootstrap
│   ├── main.server.ts                    # Server bootstrap
│   └── index.html                        # App marker for liveness probe
├── functions/
│   ├── src/
│   │   ├── index.ts                      # Exports: ssr, verifyCustomDomainFn, checkCustomDomainLiveFn
│   │   ├── auth.ts                       # Allowlist + callable request types
│   │   ├── domain-verification.ts        # DNS TXT verification logic
│   │   ├── domain-liveness.ts            # HTTPS probe + SSRF protection
│   │   └── ssr.cjs                       # CJS bridge to ESM SSR bundle
│   └── package.json                      # Node 20, firebase-admin, firebase-functions v2
├── scripts/
│   ├── setup-env.js                      # .env.local → public/env-config.json
│   └── copy-ssr.js                       # Angular SSR → functions/app/
├── public/
│   └── env-config.json                   # Runtime Firebase config (generated)
├── firebase.json                         # Hosting, Functions, Firestore config
├── firestore.rules                       # Security rules
├── firestore.indexes.json                # Composite indexes
├── angular.json                          # Angular CLI config (SSR enabled)
├── package.json                          # Root scripts + deps
└── README.md
```

---

## Current Implementation Status

### ✅ Completed

**Phase 1 — SEO + Website Settings**
- JSON-LD structured data (LocalBusiness, FAQPage)
- SEO meta tags (title, description, keywords, Open Graph, Twitter)
- Canonical URLs (custom domain aware)
- Favicon, social image, sitemap-ready markup

**Phase 2 — Categories + Templates**
- 8 business categories with Schema.org types
- 8 templates across 4 categories (Salon, Restaurant, Gym, Clothing)
- Template registry with per-template theme support
- Live template previews + generated thumbnails

**Phase 3 — Advanced Business Website Features**
- Business hours (7-day editor, JSON-LD openingHours)
- Testimonials (rating, images, carousel)
- FAQs (accordion, FAQPage JSON-LD)
- Social links (5 platforms, validated URLs)
- Primary CTA (4 action types, validated)
- Announcement bar (text + optional link)
- All integrated into builder, templates, SSR

**Phase 4 — Real Publishing + Custom Domains**
- Draft/Published states with `publishedAt`
- Public demo URLs (`/demo/<slug>`)
- Custom domain connect → TXT verification → manual Hosting setup → liveness probe
- Domain states: pending / verified / live / disabled
- Host-based routing (root `/` on custom domain)
- SSR middleware rewrite for custom domains
- Security: normalization, private IP blocking, SSRF protection, DNS rebinding guard

---

## Roadmap (Planned — Not Implemented)

### Phase 5 — SaaS + Payments
- Multi-tenant admin accounts
- Subscription plans, billing (Stripe)
- Usage limits, template gating
- Team collaboration, roles

### Phase 6 — AI Website Generation
- AI-assisted content generation (copy, images)
- Template recommendation from business category
- Automated theme selection
- One-click demo from minimal input

### Post-Phase 6
- Comprehensive test suite (unit, integration, e2e)
- Bug fixing and regression hardening
- Security review (penetration testing, dependency audit)
- Performance optimization (Core Web Vitals, bundle size)
- Production launch preparation

---

## Known Limitations

- **Custom domain infrastructure is manual** — Firebase Hosting custom domain attachment and DNS configuration require admin action in Firebase Console and DNS provider. The application verifies ownership and liveness but cannot provision Hosting.
- **Single admin email** — Allowlist contains one email; multi-admin requires code changes in 3 locations.
- **No Email/Password auth** — Only Google OAuth implemented.
- **Test coverage minimal** — Only smoke test exists; no CI pipeline configured.
- **No automated deployment** — `npm run deploy` runs locally; no GitHub Actions/GitLab CI defined.
- **Functions emulator required for local callable functions** — Domain verification/liveness checks need `cd functions && npm run serve` or deployed functions.
- **No backup/restore strategy** documented for Firestore/Storage.

---

## License

Private — Internal use only.