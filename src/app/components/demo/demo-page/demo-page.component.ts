import { Component, OnInit, OnDestroy, signal, inject, ViewContainerRef, ComponentRef, Type, PendingTasks } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BusinessService } from '../../../services/business.service';
import { Business } from '../../../models/business.model';
import {
  getTemplateComponent,
  getTemplateDisplayName,
  isTemplateSupported,
} from '../templates/template.registry';

import '../templates/template.init';

interface TemplateComponent {
  business: Business;
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
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    try {
      const business = await this.businessService.getBusinessBySlug(slug);
      if (!business) {
        this.notFound.set(true);
      } else {
        this.business.set(business);
        // Set SEO
        this.document.title = `${business.businessName} | Professional ${business.category || 'Business'}`;
        const metaDesc = this.document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', business.description || business.tagline || '');
        }
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
      const ref = this.vcr.createComponent(componentType) as ComponentRef<TemplateComponent>;
      this.templateRef = ref;
      ref.instance.business = this.business()!;
      ref.changeDetectorRef.detectChanges();
    } catch {
      this.templateUnavailable.set(true);
    }
  }

  private getDefaultTemplateForBusiness(): string {
    const business = this.business();
    if (!business) return 'salon-01';
    const category = business.category?.toLowerCase() ?? '';
    if (category === 'salon') return 'salon-01';
    return 'salon-01';
  }
}