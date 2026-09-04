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
  selector: 'app-gym01',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gym01.component.html',
  styleUrl: './gym01.component.css',
  host: {
    '[style]': 'themeCss',
    '[class]': 'themeClasses',
  },
})
export class Gym01Component implements OnInit, OnDestroy {
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
  aboutImageError = false;
  galleryImageErrors: boolean[] = [];
  activeSection = 'home';
  private scrollY = signal(0);
  private document = inject(DOCUMENT);

  private static readonly SECTION_IDS = [
    'home',
    'programs',
    'benefits',
    'gallery',
    'testimonials',
    'faq',
    'contact',
  ];

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

  private static readonly PROGRAM_ICONS = [
    'bi-lightning-charge',
    'bi-heart-pulse',
    'bi-trophy',
    'bi-fire',
    'bi-graph-up',
    'bi-shield-check',
    'bi-arrow-repeat',
    'bi-star',
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

  get displayServices(): string[] {
    const normalized = normalizeServices(this.business.services);
    return normalized.length ? normalized.map((s) => s.name) : this.getDefaultPrograms();
  }

  get displayPrograms() {
    const normalized = normalizeServices(this.business.services);
    return normalized.length ? normalized : this.getDefaultProgramsWithDesc();
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
    this.faqOpen = this.displayFaqs.map(() => false);
    this.updateScrollY();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    // Business is set before theme by the host; re-apply so the announcement
    // offset class is included even when the theme was assigned first.
    this.applyTheme();
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
    const header = document.querySelector('.gym-header');
    const headerHeight = header?.clientHeight || 0;

    let current = Gym01Component.SECTION_IDS[0];
    for (const id of Gym01Component.SECTION_IDS) {
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
      const header = document.querySelector('.gym-header');
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
    return 'Unleash your potential at our premium fitness facility. World-class equipment, expert trainers, and a community that pushes you further. Your strongest self starts here.';
  }

  private getDefaultPrograms(): string[] {
    return ['Strength Training', 'HIIT', 'Personal Training', 'Group Classes', 'Mobility & Recovery', 'Nutrition Coaching'];
  }

  private getDefaultProgramsWithDesc() {
    return [
      { name: 'Strength Training', description: 'Build muscle and power with our comprehensive resistance programs.' },
      { name: 'HIIT', description: 'High-intensity interval training for maximum results in minimum time.' },
      { name: 'Personal Training', description: 'One-on-one coaching tailored to your unique goals and fitness level.' },
      { name: 'Group Classes', description: 'Energizing group sessions led by certified instructors.' },
      { name: 'Mobility & Recovery', description: 'Dedicated sessions for flexibility, recovery, and injury prevention.' },
      { name: 'Nutrition Coaching', description: 'Custom meal plans and guidance to fuel your performance.' },
    ];
  }

  programIcon(index: number): string {
    const icons = Gym01Component.PROGRAM_ICONS;
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

  galleryClass(index: number): string {
    const pattern = ['tall', '', 'wide', ''];
    return pattern[index % pattern.length];
  }
}