import { Component, Input, HostListener, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Business } from '../../../../models/business.model';
import { normalizeServices } from '../../../../models/business.model';
import {
  ThemeConfig,
  buildThemeCss,
  themeOptionClasses,
} from '../../themes/theme.registry';
import { getCategoryDisplayName } from '../../categories/category.registry';
import {
  getAnnouncementLink,
  getFaqs,
  getSocialLinks,
  getTestimonials,
  isAnnouncementEnabled,
  resolvePrimaryCta,
  ResolvedPrimaryCta,
  starIcons,
} from '../../shared/advanced-features';

@Component({
  selector: 'app-restaurant02',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './restaurant02.component.html',
  styleUrl: './restaurant02.component.css',
  host: {
    '[style]': 'themeCss',
    '[class]': 'themeClasses',
  },
})
export class Restaurant02Component implements OnInit, OnDestroy {
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
    // Announcement offset class: pushes the fixed header below the optional
    // promo bar so navigation is never overlapped.
    const annClass = isAnnouncementEnabled(this.business) ? ' has-announcement' : '';
    this.themeClasses = (this._theme ? themeOptionClasses(this._theme) : '') + annClass;
  }

  mobileMenuOpen = false;
  lightboxOpen = false;
  lightboxIndex = 0;
  heroImageError = false;
  heroImage2Error = false;
  galleryImageErrors: boolean[] = [];
  private scrollY = signal(0);
  private document = inject(DOCUMENT);

  /** Distinct visual icons that cycle across the offerings grid. */
  private static readonly SERVICE_ICONS = [
    'bi-cup-hot',
    'bi-egg-fried',
    'bi-fire',
    'bi-basket',
    'bi-moon-stars',
    'bi-cup-straw',
    'bi-star',
    'bi-flower1',
  ];

  get heroImage(): string {
    return this.business.images?.[0] || '';
  }

  /** Secondary image for the collage tile (differs from the hero when available). */
  get heroImage2(): string {
    return this.business.images?.[1] || this.heroImage;
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

  get hasWhatsApp(): boolean {
    return !!this.business.whatsapp;
  }

  get hasPhone(): boolean {
    return !!this.business.phone;
  }

  /** Primary conversion target: WhatsApp when available, otherwise a call. */
  get primaryCtaUrl(): string {
    return this.hasWhatsApp ? this.whatsappUrl : this.hasPhone ? this.phoneUrl : '';
  }

  get primaryCtaLabel(): string {
    return this.hasWhatsApp ? 'Book a Table' : 'Call to Book';
  }

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

  /**
   * Primary conversion slot: the configurable CTA when enabled, otherwise
   * the legacy WhatsApp/phone fallback so existing behavior is preserved.
   */
  get effectiveCta(): ResolvedPrimaryCta | null {
    const resolved = this.primaryCta;
    if (resolved) return resolved;
    if (this.primaryCtaUrl) {
      return { label: this.primaryCtaLabel, href: this.primaryCtaUrl, external: this.hasWhatsApp };
    }
    return null;
  }

  /** Action-appropriate icon for the primary CTA slots. */
  get primaryCtaIcon(): string {
    const cta = this.effectiveCta;
    if (!cta) return '';
    if (cta.scrollTo) return 'bi-arrow-down';
    if (cta.href?.startsWith('https://wa.me')) return 'bi-whatsapp';
    if (!cta.external) return 'bi-telephone';
    return 'bi-arrow-up-right';
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
    const cta = this.effectiveCta;
    if (cta?.scrollTo) {
      event.preventDefault();
      this.scrollTo(cta.scrollTo);
    }
  }

  get categoryLabel(): string {
    return getCategoryDisplayName(this.business.category, 'Restaurant & Dining');
  }

  get isScrolled(): boolean {
    return this.scrollY() > 20;
  }

  get showMobileCta(): boolean {
    return window.innerWidth <= 768 && this.scrollY() > 120;
  }

  get displayDescription(): string {
    return this.business.description || this.getDefaultDescription();
  }

  /** Hero excerpt — keeps the hero scannable when the description is long. */
  get heroDescription(): string {
    const text = this.business.description || '';
    return text.length > 230 ? text.slice(0, 230).trimEnd() + '…' : text;
  }

  /** The business' "services" are rendered as today's offerings / menu picks. */
  get displayMenu(): string[] {
    const normalized = normalizeServices(this.business.services);
    return normalized.length ? normalized.map(s => s.name) : this.getDefaultMenu();
  }

  get hasImages(): boolean {
    return this.galleryImages.length > 0;
  }

  ngOnInit(): void {
    this.galleryImageErrors = this.galleryImages.map(() => false);
    this.faqOpen = this.displayFaqs.map(() => false);
    this.updateScrollY();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    // Business is set before theme by the host; re-apply so the announcement
    // offset class is included even when the theme was assigned first.
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

  @HostListener('document:keydown.arrowleft')
  onArrowLeft(): void {
    if (this.lightboxOpen) {
      this.prevLightbox();
    }
  }

  @HostListener('document:keydown.arrowright')
  onArrowRight(): void {
    if (this.lightboxOpen) {
      this.nextLightbox();
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
      const header = document.querySelector('.restaurant02-header');
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

  onHeroImage2Error(): void {
    this.heroImage2Error = true;
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

  serviceIcon(index: number): string {
    const icons = Restaurant02Component.SERVICE_ICONS;
    return icons[index % icons.length];
  }

  /**
   * Asymmetric editorial rhythm for the gallery grid.
   * Period of 4: wide, standard, tall, standard.
   */
  galleryClass(index: number): string {
    const pattern = ['wide', '', 'tall', ''];
    return pattern[index % pattern.length];
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
    return 'A warm, welcoming café built around great coffee, honest food and a space where you actually want to stay a while.';
  }

  private getDefaultMenu(): string[] {
    return ['House Blend Coffee', 'Brunch Plates', 'Fresh Salads & Bowls', 'Artisan Pastries', 'Homemade Desserts'];
  }
}
