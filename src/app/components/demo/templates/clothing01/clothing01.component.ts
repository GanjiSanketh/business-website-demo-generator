import { Component, Input, HostListener, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Business } from '../../../../models/business.model';
import { normalizeServices } from '../../../../models/business.model';
import { BusinessHours } from '../../../../models/business.model';
import {
  ThemeConfig,
  buildThemeCss,
  themeOptionClasses,
} from '../../themes/theme.registry';

@Component({
  selector: 'app-clothing01',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clothing01.component.html',
  styleUrl: './clothing01.component.css',
  host: {
    '[style]': 'themeCss',
    '[class]': 'themeClasses',
  },
})
export class Clothing01Component implements OnInit, OnDestroy {
  @Input({ required: true }) business!: Business;
  currentYear = new Date().getFullYear();

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
    this.themeClasses = this._theme ? themeOptionClasses(this._theme) : '';
  }

  mobileMenuOpen = false;
  lightboxOpen = false;
  lightboxIndex = 0;
  heroImageError = false;
  aboutImageError = false;
  galleryImageErrors: boolean[] = [];
  activeSection = 'home';
  private scrollY = signal(0);
  private document = inject(DOCUMENT);

  private static readonly SECTION_IDS = ['home', 'collection', 'about', 'gallery', 'contact'];

  private static readonly CATEGORY_ICONS = [
    'bi-bag',
    'bi-tag',
    'bi-gem',
    'bi-star',
    'bi-heart',
    'bi-award',
    'bi-sparkles',
    'bi-flower1',
  ];

  get heroImage(): string {
    return this.business.images?.[0] || '';
  }

  get aboutImage(): string {
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

  get displayDescription(): string {
    return this.business.description || this.getDefaultDescription();
  }

  get displayCategories(): string[] {
    const normalized = normalizeServices(this.business.services);
    return normalized.length ? normalized.map((s) => s.name) : this.getDefaultCategories();
  }

  get displayCollection() {
    const normalized = normalizeServices(this.business.services);
    return normalized.length 
      ? normalized.slice(0, 6).map((s, i) => ({ name: s.name, description: s.description || 'Curated selection', image: this.business.images?.[i + 2] || '' }))
      : this.getDefaultCollection();
  }

  get businessHours(): BusinessHours | undefined {
    return this.business.businessHours;
  }

  get hasBusinessHours(): boolean {
    if (!this.businessHours) return false;
    return Object.values(this.businessHours).some((d: any) => d && !d.closed);
  }

  get isScrolled(): boolean {
    return this.scrollY() > 20;
  }

  get showMobileCta(): boolean {
    return window.innerWidth <= 768 && this.scrollY() > 100;
  }

  ngOnInit(): void {
    this.galleryImageErrors = this.galleryImages.map(() => false);
    this.updateScrollY();
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    this.document.body.style.overflow = '';
  }

  private onScroll = (): void => {
    this.scrollY.set(window.scrollY);
    this.updateActiveSection();
  };

  private updateScrollY(): void {
    this.scrollY.set(window.scrollY);
    this.updateActiveSection();
  }

  private updateActiveSection(): void {
    const scrollPos = window.scrollY + window.innerHeight * 0.3;
    const header = document.querySelector('.clothing-header');
    const headerHeight = header?.clientHeight || 0;

    let current = Clothing01Component.SECTION_IDS[0];
    for (const id of Clothing01Component.SECTION_IDS) {
      const el = document.getElementById(id);
      if (el && el.offsetTop - headerHeight <= scrollPos) {
        current = id;
      }
    }
    if (current !== this.activeSection) {
      this.activeSection = current;
    }
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

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      const header = document.querySelector('.clothing-header');
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

  onAboutImageError(): void {
    this.aboutImageError = true;
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
    return 'Curating timeless style for the modern wardrobe. Discover pieces that transcend seasons — crafted with intention, worn with confidence.';
  }

  private getDefaultCategories(): string[] {
    return ['Ready-to-Wear', 'Accessories', 'Footwear', 'Outerwear', 'Knitwear', 'Evening'];
  }

  private getDefaultCollection() {
    return [
      { name: 'Spring Essentials', description: 'Light layers for transitional days.', image: '' },
      { name: 'Evening Edit', description: 'Elevated pieces for after dark.', image: '' },
      { name: 'Weekend Casual', description: 'Effortless style for off-duty moments.', image: '' },
      { name: 'Outerwear', description: 'Investment coats and jackets.', image: '' },
      { name: 'Accessories', description: 'The finishing touches that define.', image: '' },
      { name: 'Footwear', description: 'From studio to street.', image: '' },
    ];
  }

  categoryIcon(index: number): string {
    const icons = Clothing01Component.CATEGORY_ICONS;
    return icons[index % icons.length];
  }

  formatDayHours(day: string): string {
    const dh = this.businessHours?.[day as keyof BusinessHours];
    if (!dh || dh.closed) return 'Closed';
    return `${dh.open} – ${dh.close}`;
  }

  isDayOpen(day: string): boolean {
    const dh = this.businessHours?.[day as keyof BusinessHours];
    return !!(dh && !dh.closed);
  }
}