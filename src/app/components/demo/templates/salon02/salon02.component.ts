import { Component, Input, HostListener, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Business } from '../../../../models/business.model';
import { normalizeServices } from '../../../../models/business.model';
import {
  ThemeConfig,
  buildThemeCss,
  themeOptionClasses,
} from '../../themes/theme.registry';
import {
  getAnnouncementLink,
  getFaqs,
  getSocialLinks,
  getTestimonials,
  isAnnouncementEnabled,
  resolvePrimaryCta,
  starIcons,
} from '../../shared/advanced-features';

@Component({
  selector: 'app-salon02',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './salon02.component.html',
  styleUrl: './salon02.component.css',
  host: {
    '[style]': 'themeCss',
    '[class]': 'themeClasses',
  },
})
export class Salon02Component implements OnInit, OnDestroy {
  @Input({ required: true }) business!: Business;
  currentYear = new Date().getFullYear();

  /** Theme applied as inline CSS vars + option classes on the host. */
  private _theme: ThemeConfig | null = null;
  protected themeCss = '';
  protected themeClasses = '';

  @Input()
  set theme(value: ThemeConfig | null | undefined) {
    this._theme = value ?? null;
    this.applyTheme();
  }

  private applyTheme(): void {
    this.themeCss = this._theme ? buildThemeCss(this._theme) : '';
    const annClass = isAnnouncementEnabled(this.business) ? ' has-announcement' : '';
    this.themeClasses = (this._theme ? themeOptionClasses(this._theme) : '') + annClass;
  }

  mobileMenuOpen = false;
  lightboxOpen = false;
  lightboxIndex = 0;
  heroImageError = false;
  galleryImageErrors: boolean[] = [];
  private scrollY = signal(0);
  private document = inject(DOCUMENT);

  // ---- Phase 3 optional features ----
  faqOpen: boolean[] = [];

  get announcementEnabled(): boolean {
    return isAnnouncementEnabled(this.business);
  }

  get announcementText(): string {
    return this.business.announcement?.text?.trim() || '';
  }

  get announcementLink(): string | null {
    return getAnnouncementLink(this.business);
  }

  get announcementLinkText(): string {
    return this.business.announcement?.linkText?.trim() || '';
  }

  get socialLinks() {
    return getSocialLinks(this.business);
  }

  get primaryCta() {
    return resolvePrimaryCta(this.business, this.phoneUrl, this.whatsappUrl);
  }

  get displayTestimonials() {
    return getTestimonials(this.business);
  }

  get displayFaqs() {
    return getFaqs(this.business);
  }

  starsFor(rating?: number): { filled: number; empty: number } {
    return starIcons(rating || 0);
  }

  toggleFaq(index: number): void {
    this.faqOpen[index] = !this.faqOpen[index];
  }

  isFaqOpen(index: number): boolean {
    return !!this.faqOpen[index];
  }

  onPrimaryCtaClick(event: MouseEvent): void {
    const cta = this.primaryCta;
    if (cta?.scrollTo) {
      event.preventDefault();
      this.scrollTo(cta.scrollTo);
    }
  }

  get heroImage(): string {
    return this.business.images?.[0] || '';
  }

  get galleryImages(): string[] {
    return this.business.images || [];
  }

  get whatsappUrl(): string {
    const phone = this.normalizePhoneForWhatsApp(this.business.whatsapp || '');
    return `https://wa.me/${phone}`;
  }

  get phoneUrl(): string {
    const phone = this.normalizePhoneForTel(this.business.phone || '');
    return `tel:${phone}`;
  }

  get mapsUrl(): string {
    const address = encodeURIComponent(this.business.address || '');
    return `https://www.google.com/maps/search/?api=1&query=${address}`;
  }

  get hasContactInfo(): boolean {
    return !!(this.business.phone || this.business.whatsapp || this.business.address);
  }

  get isScrolled(): boolean {
    return this.scrollY() > 20;
  }

  get showMobileCta(): boolean {
    return window.innerWidth <= 768 && this.scrollY() > 100;
  }

  get displayDescription(): string {
    return this.business.description || this.getDefaultDescription();
  }

  get displayServices(): string[] {
    const normalized = normalizeServices(this.business.services);
    return normalized.length ? normalized.map(s => s.name) : this.getDefaultServices();
  }

  ngOnInit(): void {
    this.galleryImageErrors = this.galleryImages.map(() => false);
    this.faqOpen = this.displayFaqs.map(() => false);
    this.updateScrollY();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.applyTheme();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    // The bare global `document` isn't available in this app's SSR
    // environment — only Angular's DI-provided DOCUMENT token resolves
    // correctly on both the server and the browser. This is the only
    // document access in this component that SSR actually reaches (the
    // others only run from click/keydown handlers, which never fire
    // server-side).
    this.document.body.style.overflow = '';
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 768 && this.mobileMenuOpen) {
      this.mobileMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxOpen) {
      this.lightboxOpen = false;
      document.body.style.overflow = '';
    }
  }

  private onScroll = (): void => {
    this.scrollY.set(window.scrollY);
  };

  private updateScrollY(): void {
    this.scrollY.set(window.scrollY);
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      const header = document.querySelector('.salon02-header');
      const headerHeight = header?.clientHeight || 0;
      const top = el.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    this.mobileMenuOpen = false;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  onHeroImageError(): void {
    this.heroImageError = true;
  }

  onGalleryImageError(index: number): void {
    this.galleryImageErrors[index] = true;
  }

  openLightbox(index: number): void {
    this.lightboxIndex = index;
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    document.body.style.overflow = '';
  }

  nextLightbox(): void {
    if (this.galleryImages.length > 1) {
      this.lightboxIndex = (this.lightboxIndex + 1) % this.galleryImages.length;
    }
  }

  prevLightbox(): void {
    if (this.galleryImages.length > 1) {
      this.lightboxIndex = (this.lightboxIndex - 1 + this.galleryImages.length) % this.galleryImages.length;
    }
  }

  private normalizePhoneForWhatsApp(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return '91' + digits;
    }
    if (digits.length >= 11) {
      return digits;
    }
    return digits;
  }

  private normalizePhoneForTel(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      return '+91' + digits;
    }
    if (digits.length >= 11) {
      return '+' + digits;
    }
    return '+' + digits;
  }

  private getDefaultDescription(): string {
    return 'We are a premium beauty salon dedicated to enhancing your natural beauty. Our expert stylists use the finest products and latest techniques to deliver an exceptional experience every time you visit.';
  }

  private getDefaultServices(): string[] {
    return ['Haircut', 'Hair Styling', 'Hair Coloring', 'Facial', 'Bridal Makeup'];
  }
}