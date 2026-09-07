import { Component, OnInit, OnDestroy, signal, inject, ViewContainerRef, ComponentRef, Type, PendingTasks } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BusinessService } from '../../../services/business.service';
import { Business } from '../../../models/business.model';
import {
  getTemplateComponent,
  getDefaultThemeForTemplate,
  getTemplateDisplayName,
  isTemplateSupported,
  getDefaultTemplateForCategory,
} from '../templates/template.registry';
import { resolveThemeConfig, ThemeConfig } from '../themes/theme.registry';
import { getCategoryById } from '../categories/category.registry';
import { getFaqs, getSocialLinks } from '../shared/advanced-features';
import { isCustomDomainActive, getCanonicalUrl } from '../shared/domain-utils';

import '../templates/template.init';

interface TemplateComponent {
  business: Business;
  theme?: ThemeConfig;
}

@Component({
  selector: 'app-demo-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './demo-page.component.html',
  styleUrl: './demo-page.component.css',
})
export class DemoPageComponent implements OnInit, OnDestroy {
  loading = signal(true);
  notFound = signal(false);
  templateUnavailable = signal(false);
  business = signal<Business | null>(null);
  private originalTitle = '';
  private templateRef: ComponentRef<TemplateComponent> | null = null;

  private vcr = inject(ViewContainerRef);
  private route = inject(ActivatedRoute);
  private businessService = inject(BusinessService);
  private pendingTasks = inject(PendingTasks);
  // The bare global `document` isn't patched in this app's SSR environment —
  // only Angular's DI-provided DOCUMENT token resolves correctly on both
  // the server and the browser.
  private document = inject(DOCUMENT);

  ngOnInit(): void {
    this.originalTitle = this.document.title;
    // This app is zoneless, so Angular has no automatic way to know the
    // Firestore lookup in loadBusiness() is in flight. Without registering
    // it as a pending task, SSR considers the app "stable" immediately and
    // serializes the response before the lookup (and the resulting template
    // render) ever runs, shipping an empty page to the client.
    this.pendingTasks.run(() => this.loadBusiness());
  }

  ngOnDestroy(): void {
    this.document.title = this.originalTitle;
    this.templateRef?.destroy();
  }

  private async loadBusiness(): Promise<void> {
    let slug = this.route.snapshot.paramMap.get('slug');
    let business: Business | null = null;

    if (!slug) {
      // Host-based serving: the root ('/') of a verified/live custom domain
      // renders the owning business' demo. The SSR middleware rewrites such
      // requests to /demo/:slug before Angular runs, so this branch is only
      // exercised by the hydrated client at '/' (kept on the demo page by
      // hostDemoGuard).
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      if (host) {
        business = await this.businessService.getBusinessByHost(host);
        if (business) slug = business.slug;
      }
      if (!business) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
    }

    try {
      if (!business) {
        business = await this.businessService.getBusinessBySlug(slug!);
      }
      if (!business) {
        this.notFound.set(true);
      } else {
        this.business.set(business);
        // Set all SEO metadata
        // slug is non-null here: either the route param or the resolved
        // business' own slug from the host fallback above.
        this.setSeoMetadata(business, slug!);
        // Render the template
        this.renderTemplate(business.templateId);
      }
    } catch (err) {
      // Distinguish "genuinely not found" from "failed to check" in the
      // console — the UI still shows the same not-found state either way,
      // but a permission-denied/network/config error was previously
      // indistinguishable from a real 404, which makes exactly this class
      // of bug (a published business appearing as "not found") unreadable.
      console.error('[DemoPage] Failed to load business:', err);
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Set all SEO metadata for the page. */
  private setSeoMetadata(business: Business, slug: string): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pageUrl = origin ? `${origin}/demo/${slug}` : `/demo/${slug}`;
    // Use custom domain as canonical URL if verified, otherwise use demo URL
    const canonicalUrl = getCanonicalUrl(business, origin);

    // --- Title ---
    const title = business.seoTitle?.trim()
      ? `${business.seoTitle} | ${business.businessName}`
      : `${business.businessName} | Professional ${business.category || 'Business'}`;
    this.document.title = title;

    // --- Meta Description ---
    const description = business.seoDescription?.trim() || business.description || business.tagline || '';
    this.setMetaTag('name', 'description', description);

    // --- Meta Keywords ---
    if (business.seoKeywords?.trim()) {
      this.setMetaTag('name', 'keywords', business.seoKeywords.trim());
    }

    // --- Open Graph ---
    const ogTitle = business.seoTitle?.trim() || business.businessName;
    const ogDescription = description;
    const ogImage = business.socialImageUrl || business.logoUrl || business.images?.[0] || '';
    const ogType = 'website';

    this.setMetaTag('property', 'og:title', ogTitle);
    this.setMetaTag('property', 'og:description', ogDescription);
    if (ogImage) {
      this.setMetaTag('property', 'og:image', ogImage);
    }
    // Use canonical URL for og:url when custom domain is verified
    this.setMetaTag('property', 'og:url', canonicalUrl);
    this.setMetaTag('property', 'og:type', ogType);
    this.setMetaTag('property', 'og:site_name', business.businessName);

    // --- Twitter / X ---
    const twitterCard = ogImage ? 'summary_large_image' : 'summary';
    this.setMetaTag('name', 'twitter:card', twitterCard);
    this.setMetaTag('name', 'twitter:title', ogTitle);
    this.setMetaTag('name', 'twitter:description', ogDescription);
    if (ogImage) {
      this.setMetaTag('name', 'twitter:image', ogImage);
    }

    // --- Canonical URL ---
    this.setLinkTag('canonical', canonicalUrl);

    // --- Favicon ---
    const faviconUrl = business.faviconUrl || business.logoUrl;
    if (faviconUrl) {
      this.setLinkTag('icon', faviconUrl);
      this.setLinkTag('apple-touch-icon', faviconUrl);
    }

    // --- JSON-LD Structured Data ---
    this.injectJsonLd(business, canonicalUrl, ogImage);
    this.injectFaqJsonLd(business, canonicalUrl);
  }

  /** Helper to set/update a meta tag. */
  private setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
    if (!content) return;
    const selector = `meta[${attr}="${key}"]`;
    let meta = this.document.querySelector(selector) as HTMLMetaElement | null;
    if (!meta) {
      meta = this.document.createElement('meta');
      meta.setAttribute(attr, key);
      this.document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  /** Helper to set/update a link tag. */
  private setLinkTag(rel: string, href: string): void {
    if (!href) return;
    const selector = `link[rel="${rel}"]`;
    let link = this.document.querySelector(selector) as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', rel);
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /** Inject JSON-LD structured data. */
  private injectJsonLd(business: Business, pageUrl: string, imageUrl: string): void {
    const categoryMeta = getCategoryById(business.category);
    const schemaType = categoryMeta?.schemaType || 'LocalBusiness';

    // Build opening hours specification if available
    const openingHours = this.buildOpeningHours(business.businessHours);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': schemaType,
      name: business.businessName,
      description: business.seoDescription?.trim() || business.description || business.tagline || '',
      url: pageUrl,
      telephone: business.phone || undefined,
      address: business.address ? {
        '@type': 'PostalAddress',
        streetAddress: business.address,
      } : undefined,
      image: imageUrl || undefined,
      openingHours,
      sameAs: this.buildSocialLinks(business),
    };

    // Remove undefined values
    const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd, (_, value) =>
      value === undefined ? null : value
    ));

    // Remove null values
    const removeNulls = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(removeNulls).filter(v => v !== null);
      if (obj && typeof obj === 'object') {
        const cleaned: any = {};
        for (const [k, v] of Object.entries(obj)) {
          const cleanedV = removeNulls(v);
          if (cleanedV !== null && cleanedV !== '' && !(Array.isArray(cleanedV) && cleanedV.length === 0)) {
            cleaned[k] = cleanedV;
          }
        }
        return Object.keys(cleaned).length ? cleaned : null;
      }
      return obj;
    };

    const finalJsonLd = removeNulls(cleanJsonLd);

    const scriptSelector = 'script[type="application/ld+json"][data-seo="business"]';
    let script = this.document.querySelector(scriptSelector) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-seo', 'business');
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(finalJsonLd);
  }

  /** Build openingHours array from businessHours. */
  private buildOpeningHours(businessHours?: Business['businessHours']): string[] | undefined {
    if (!businessHours) return undefined;
    const dayMap: Record<string, string> = {
      monday: 'Mo',
      tuesday: 'Tu',
      wednesday: 'We',
      thursday: 'Th',
      friday: 'Fr',
      saturday: 'Sa',
      sunday: 'Su',
    };
    const hours: string[] = [];
    for (const [day, key] of Object.entries(dayMap)) {
      const dh = businessHours[day as keyof typeof businessHours];
      if (dh && !dh.closed && dh.open && dh.close) {
        hours.push(`${key} ${dh.open}-${dh.close}`);
      }
    }
    return hours.length ? hours : undefined;
  }

  /** Build sameAs array from the configured social profile URLs. */
  private buildSocialLinks(business: Business): string[] | undefined {
    const links = getSocialLinks(business);
    return links.length ? links.map((l) => l.url) : undefined;
  }

  /**
   * Inject a separate FAQPage JSON-LD block when FAQs are configured. Kept
   * in its own <script data-seo="faq"> so the existing LocalBusiness
   * structured data is never modified; nothing is emitted when there are no
   * FAQs (avoiding invalid/empty structured data).
   */
  private injectFaqJsonLd(business: Business, pageUrl: string): void {
    const faqs = getFaqs(business);
    if (!faqs.length) {
      this.removeFaqJsonLd();
      return;
    }
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    };
    const scriptSelector = 'script[type="application/ld+json"][data-seo="faq"]';
    let script = this.document.querySelector(scriptSelector) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-seo', 'faq');
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  }

  /** Remove a previously injected FAQ JSON-LD block (when FAQs are gone). */
  private removeFaqJsonLd(): void {
    const existing = this.document.querySelector(
      'script[type="application/ld+json"][data-seo="faq"]'
    ) as HTMLScriptElement | null;
    existing?.remove();
  }

  private renderTemplate(templateId: string): void {
    // Use fallback for backward compatibility
    const effectiveTemplateId = templateId || this.getDefaultTemplateForBusiness();

    if (!isTemplateSupported(effectiveTemplateId)) {
      this.templateUnavailable.set(true);
      return;
    }

    const componentType = getTemplateComponent(effectiveTemplateId);
    if (!componentType) {
      this.templateUnavailable.set(true);
      return;
    }

    try {
      const business = this.business()!;
      const ref = this.vcr.createComponent(componentType) as ComponentRef<TemplateComponent>;
      this.templateRef = ref;
      ref.instance.business = business;
      // Theme = persisted choices (themeId + style overrides) resolved against
      // the registry, falling back to the template's default theme.
      ref.instance.theme = resolveThemeConfig(
        business.themeId,
        business.themeOptions,
        getDefaultThemeForTemplate(effectiveTemplateId)
      );
      ref.changeDetectorRef.detectChanges();
    } catch {
      this.templateUnavailable.set(true);
    }
  }

  /** Category's first registered template (registry-driven; 'salon-01' only
   *  remains as an ultimate safety net when no category matches). */
  private getDefaultTemplateForBusiness(): string {
    const category = this.business()?.category ?? '';
    return getDefaultTemplateForCategory(category) ?? 'salon-01';
  }
}