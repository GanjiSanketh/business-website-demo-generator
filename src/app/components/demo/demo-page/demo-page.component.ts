import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BusinessService } from '../../../services/business.service';
import { Business } from '../../../models/business.model';
import { Salon01Component } from '../salon01/salon01.component';

@Component({
  selector: 'app-demo-page',
  standalone: true,
  imports: [CommonModule, Salon01Component],
  templateUrl: './demo-page.component.html',
  styleUrl: './demo-page.component.css',
})
export class DemoPageComponent implements OnInit, OnDestroy {
  loading = signal(true);
  notFound = signal(false);
  business = signal<Business | null>(null);
  private originalTitle = '';

  constructor(
    private route: ActivatedRoute,
    private businessService: BusinessService
  ) {}

  ngOnInit(): void {
    this.originalTitle = document.title;
    this.loadBusiness();
  }

  ngOnDestroy(): void {
    document.title = this.originalTitle;
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
        document.title = `${business.businessName} | Professional ${business.category || 'Business'}`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', business.description || business.tagline || '');
        }
      }
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
