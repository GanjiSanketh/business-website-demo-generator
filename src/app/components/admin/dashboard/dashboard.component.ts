import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BusinessService } from '../../../services/business.service';
import { Business } from '../../../models/business.model';
import { AuthService } from '../../../services/auth.service';
import { StorageService } from '../../../services/storage.service';
import { ScreenshotDialogComponent } from '../screenshot-dialog/screenshot-dialog.component';
import { getTemplateDisplayName } from '../../demo/templates/template.registry';

type StatusFilter = 'all' | 'published' | 'draft';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ScreenshotDialogComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  businesses = signal<Business[]>([]);
  loading = signal(true);
  totalBusinesses = signal(0);
  publishedCount = signal(0);
  draftCount = signal(0);
  searchQuery = signal('');
  statusFilter = signal<StatusFilter>('all');
  deleteConfirmId = signal<string | null>(null);
  deleteConfirmName = signal<string>('');
  duplicatingId = signal<string | null>(null);

  screenshotBusiness = signal<Business | null>(null);
  screenshotDialogOpen = signal(false);

  toastMessage = signal('');
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private businessService: BusinessService,
    private authService: AuthService,
    private storageService: StorageService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadBusinesses();
  }

  showToast(message: string): void {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastMessage.set(message);
    this.toastTimeout = setTimeout(() => this.toastMessage.set(''), 2500);
  }

  async loadBusinesses(): Promise<void> {
    this.loading.set(true);
    try {
      const businesses = await this.businessService.getBusinesses();
      this.businesses.set(businesses);
      this.totalBusinesses.set(businesses.length);
      this.publishedCount.set(
        businesses.filter((b) => b.status === 'published').length
      );
      this.draftCount.set(
        businesses.filter((b) => b.status === 'draft').length
      );
    } catch (err: any) {
      console.error('[Dashboard] Failed to load businesses:', err);
      if (err?.message?.includes('Firestore database is not available') || err?.message?.includes('NOT_FOUND')) {
        this.showToast('Firestore database has not been created yet. Please go to Firebase Console → Firestore Database → Create database.');
      } else {
        this.showToast('Failed to load businesses. Please try again.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  get filteredBusinesses(): Business[] {
    let result = this.businesses();

    // Status filter
    const filter = this.statusFilter();
    if (filter !== 'all') {
      result = result.filter((b) => b.status === filter);
    }

    // Search query
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      result = result.filter(
        (b) =>
          b.businessName.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          this.getTemplateLabel(b.templateId).toLowerCase().includes(q) ||
          b.status.toLowerCase().includes(q)
      );
    }

    return result;
  }

  getDemoUrl(business: Business): string {
    return `${window.location.origin}/demo/${business.slug}`;
  }

  openDemo(business: Business): void {
    window.open(this.getDemoUrl(business), '_blank');
  }

  copyDemoUrl(business: Business): void {
    const url = this.getDemoUrl(business);
    navigator.clipboard
      .writeText(url)
      .then(() => this.showToast('Demo URL copied.'))
      .catch(() => this.showToast('Failed to copy URL.'));
  }

  confirmDelete(business: Business): void {
    this.deleteConfirmId.set(business.id!);
    this.deleteConfirmName.set(business.businessName);
  }

  cancelDelete(): void {
    this.deleteConfirmId.set(null);
    this.deleteConfirmName.set('');
  }

  async deleteBusiness(business: Business): Promise<void> {
    try {
      if (business.logoUrl) {
        await this.storageService.deleteFile(business.logoUrl);
      }
      if (business.images) {
        for (const imageUrl of business.images) {
          await this.storageService.deleteFile(imageUrl);
        }
      }
      await this.businessService.deleteBusiness(business.id!);
      this.showToast(`"${business.businessName}" deleted.`);
      await this.loadBusinesses();
    } catch (err) {
      console.error('Error deleting business:', err);
      this.showToast('Failed to delete business.');
    }
    this.deleteConfirmId.set(null);
    this.deleteConfirmName.set('');
  }

  async toggleStatus(business: Business): Promise<void> {
    const newStatus = business.status === 'published' ? 'draft' : 'published';
    await this.businessService.updateBusiness(business.id!, {
      status: newStatus,
    });
    this.showToast(
      newStatus === 'published'
        ? `"${business.businessName}" published.`
        : `"${business.businessName}" unpublished.`
    );
    await this.loadBusinesses();
  }

  async duplicateBusiness(business: Business): Promise<void> {
    this.duplicatingId.set(business.id!);
    try {
      const newId = await this.businessService.duplicateBusiness(business);
      this.showToast(`"${business.businessName}" duplicated.`);
      await this.loadBusinesses();
    } catch (err) {
      console.error('Error duplicating business:', err);
      this.showToast('Failed to duplicate business.');
    }
    this.duplicatingId.set(null);
  }

  openScreenshotDialog(business: Business): void {
    this.screenshotBusiness.set(business);
    this.screenshotDialogOpen.set(true);
  }

  closeScreenshotDialog(): void {
    this.screenshotDialogOpen.set(false);
    this.screenshotBusiness.set(null);
  }

  formatDate(date: any): string {
    if (!date) return '—';
    const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatDateTime(date: any): string {
    if (!date) return '—';
    const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  onStatusFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'all' || value === 'published' || value === 'draft') {
      this.statusFilter.set(value);
    }
  }

  getTemplateLabel(templateId: string): string {
    return getTemplateDisplayName(templateId);
  }
}