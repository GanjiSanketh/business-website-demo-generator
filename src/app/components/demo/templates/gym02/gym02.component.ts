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
  selector: 'app-gym02',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gym02.component.html',
  styleUrl: './gym02.component.css',
  host: {
    '[style]': 'themeCss',
    '[class]': 'themeClasses',
  },
})
export class Gym02Component implements OnInit, OnDestroy {
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

  private static readonly SECTION_IDS = ['home', 'features', 'programs', 'trainers', 'gallery', 'contact'];

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

  get displayTrainers() {
    const normalized = normalizeServices(this.business.services);
    return normalized.length
      ? normalized.slice(0, 4).map((s, i) => ({ name: s.name, specialty: s.description || 'Certified Trainer', image: this.business.images?.[i + 2] || '' }))
      : this.getDefaultTrainers();
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
    const header = document.querySelector('.gym2-header');
    const headerHeight = header?.clientHeight || 0;

    let current = Gym02Component.SECTION_IDS[0];
    for (const id of Gym02Component.SECTION_IDS) {
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
      const header = document.querySelector('.gym2-header');
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
    return 'A modern fitness experience designed for real results. Clean facilities, expert guidance, and a supportive community — all focused on your goals.';
  }

  private getDefaultPrograms(): string[] {
    return ['Strength & Conditioning', 'Metabolic Training', 'Functional Movement', 'Yoga & Mobility', 'Personal Coaching', 'Small Group Training'];
  }

  private getDefaultTrainers() {
    return [
      { name: 'Alex Chen', specialty: 'Strength & Conditioning Specialist', image: '' },
      { name: 'Maria Santos', specialty: 'Mobility & Recovery Coach', image: '' },
      { name: 'James Wilson', specialty: 'Metabolic Training Expert', image: '' },
      { name: 'Sarah Kim', specialty: 'Yoga & Mindfulness Instructor', image: '' },
    ];
  }

  getProgramDescription(program: string): string {
    const descriptions: Record<string, string> = {
      'Strength & Conditioning': 'Build power and resilience with progressive overload training.',
      'Metabolic Training': 'High-intensity intervals for maximum calorie burn and conditioning.',
      'Functional Movement': 'Improve mobility, stability, and real-world movement patterns.',
      'Yoga & Mobility': 'Enhance flexibility, balance, and mind-body connection.',
      'Personal Coaching': 'Custom programming and 1-on-1 guidance for your specific goals.',
      'Small Group Training': 'Semi-private sessions with expert coaching and community energy.',
    };
    return descriptions[program] || 'Expert-led sessions designed for results.';
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