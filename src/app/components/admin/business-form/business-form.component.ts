import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  HostListener,
  ViewChild,
  ElementRef,
  ViewContainerRef,
  ComponentRef,
  EnvironmentInjector,
  inject,
  createComponent,
  Type,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormControl,
  Validators,
  FormArray,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule, CanDeactivate } from '@angular/router';
import { BusinessService } from '../../../services/business.service';
import { StorageService } from '../../../services/storage.service';
import { ScreenshotService } from '../../../services/screenshot.service';
import { SubscriptionService } from '../../../services/subscription.service';
import {
  Business,
  ServiceItem,
  BusinessHours,
  DayHours,
  Testimonial,
  FAQItem,
  SocialLinks,
  PrimaryCta,
  PrimaryCtaAction,
  AnnouncementConfig,
  CustomDomainConfig,
  normalizeServices,
  servicesToNames,
} from '../../../models/business.model';
import {
  isValidHttpUrl,
  SCROLL_CTA_TARGETS,
  SOCIAL_PLATFORMS,
} from '../../demo/shared/advanced-features';
import {
  normalizeDomain,
  isValidDomainHostname,
  generateVerificationToken,
  VERIFICATION_TXT_HOST,
  getVerificationTxtValue,
  isCustomDomainActive,
} from '../../demo/shared/domain-utils';
import {
  getDefaultTemplateForCategory,
  getDefaultThemeForTemplate,
  getSupportedThemesForTemplate,
  getTemplatesForCategory,
  getTemplateComponent,
  getTemplateDisplayName,
  isTemplateSupported,
  TemplateMetadata,
} from '../../demo/templates/template.registry';
import {
  CategoryMetadata,
  getCategories,
  getCategoryDisplayName,
  getTemplateCountForCategory,
  normalizeCategoryKey,
  getCategoryById,
} from '../../demo/categories/category.registry';
import {
  BUTTON_STYLE_OPTIONS,
  ButtonStyle,
  DEFAULT_THEME_ID,
  GalleryStyle,
  GALLERY_STYLE_OPTIONS,
  getThemeById,
  getThemeDisplayName,
  HeroStyle,
  HERO_STYLE_OPTIONS,
  ThemeConfig,
  ThemeOptions,
  ThemePreset,
  getThemes,
  resolveThemeConfig,
} from '../../demo/themes/theme.registry';

// Registers template components into the shared registry so previews can
// dynamically mount any supported template with the current form data.
import '../../demo/templates/template.init';

@Component({
  selector: 'app-business-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './business-form.component.html',
  styleUrl: './business-form.component.css',
})
export class BusinessFormComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  isEditMode = signal(false);
  businessId = signal<string>('');
  loading = signal(false);
  saving = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  demoUrl = signal('');
  logoPreview = signal<string>('');
  imagePreviews = signal<string[]>([]);
  logoFile = signal<File | null>(null);
  imageFiles = signal<File[]>([]);
  removedExistingImages = signal<string[]>([]);
  dragOverLogo = signal(false);
  dragOverImages = signal(false);
  // Settings: favicon & social image
  faviconPreview = signal<string>('');
  faviconFile = signal<File | null>(null);
  dragOverFavicon = signal(false);
  socialImagePreview = signal<string>('');
  socialImageFile = signal<File | null>(null);
  dragOverSocialImage = signal(false);
  copySuccess = signal(false);
  private formPristine = true;

  // ---- Custom Domain (Phase 4) ----
  customDomainInput = signal('');
  customDomainStatus = signal<'idle' | 'checking' | 'connected' | 'error'>('idle');
  customDomainError = signal('');
  customDomainVerifying = signal(false);
  showVerificationToken = signal(false);
  customDomainLiveChecking = signal(false);
  customDomainLiveResult = signal('');
  private customDomainOriginal: CustomDomainConfig | null = null;

  // ---- Builder workspace (edit mode) ----
  /** true when rendered through /admin/business/:id/edit. */
  builderLayout = signal(false);
  builderSection = signal<'info' | 'design' | 'content' | 'settings'>('info');
  /** Active sub-tab inside the Content panel. */
  contentSection = signal<
    | 'services'
    | 'gallery'
    | 'testimonials'
    | 'faqs'
    | 'social'
    | 'cta'
    | 'announcement'
  >('services');
  /** Content sub-navigation (Services → Announcement). */
  readonly contentSubSections = [
    { id: 'services', icon: 'bi-journal-text', label: 'Services' },
    { id: 'gallery', icon: 'bi-images', label: 'Gallery' },
    { id: 'testimonials', icon: 'bi-chat-quote', label: 'Testimonials' },
    { id: 'faqs', icon: 'bi-question-circle', label: 'FAQ' },
    { id: 'social', icon: 'bi-share', label: 'Social Links' },
    { id: 'cta', icon: 'bi-bullseye', label: 'Primary CTA' },
    { id: 'announcement', icon: 'bi-megaphone', label: 'Announcement' },
  ] as const;
  /** Social platforms editable in the builder. */
  readonly socialPlatformDefs = [
    { key: 'instagram', label: 'Instagram', icon: 'bi-instagram', placeholder: 'https://instagram.com/yourpage' },
    { key: 'facebook', label: 'Facebook', icon: 'bi-facebook', placeholder: 'https://facebook.com/yourpage' },
    { key: 'youtube', label: 'YouTube', icon: 'bi-youtube', placeholder: 'https://youtube.com/@yourchannel' },
    { key: 'linkedin', label: 'LinkedIn', icon: 'bi-linkedin', placeholder: 'https://linkedin.com/company/yourpage' },
    { key: 'x', label: 'X (Twitter)', icon: 'bi-twitter-x', placeholder: 'https://x.com/yourhandle' },
  ] as const;
  /** Section ids a scroll CTA may target (exposed for the builder UI). */
  readonly scrollCtaTargets = SCROLL_CTA_TARGETS;
  /** Primary CTA action types. */
  readonly ctaActionOptions = [
    { value: 'phone', label: 'Phone', icon: 'bi-telephone', hint: 'Calls the business phone' },
    { value: 'whatsapp', label: 'WhatsApp', icon: 'bi-whatsapp', hint: 'Opens a WhatsApp chat' },
    { value: 'url', label: 'External URL', icon: 'bi-box-arrow-up-right', hint: 'Opens a link (e.g. booking page)' },
    { value: 'scroll', label: 'Scroll to section', icon: 'bi-arrow-down-circle', hint: 'Scrolls to a section of the page' },
  ] as const;
  builderDevice = signal<'desktop' | 'tablet' | 'mobile'>('desktop');
  savedState = signal<'saved' | 'dirty' | 'saving'>('saved');
  notFoundBusiness = signal(false);
  /** Mobile-only config drawer toggle (no effect on desktop layout). */
  panelOpen = signal(false);
  builderPreviewError = signal('');
  readonly builderSections = [
    {
      id: 'info',
      icon: 'bi-building',
      label: 'Information',
      hint: 'Name, contact & branding',
    },
    { id: 'design', icon: 'bi-layout-text-window-reverse', label: 'Design', hint: 'Website design & style' },
    { id: 'content', icon: 'bi-images', label: 'Content', hint: 'Services, testimonials & more' },
    { id: 'settings', icon: 'bi-gear', label: 'Settings', hint: 'SEO, hours & branding' },
  ] as const;
  private builderRef: ComponentRef<{ business: Business; theme?: ThemeConfig }> | null =
    null;
  private builderPreviewTimer: ReturnType<typeof setTimeout> | null = null;
  private builderFitRaf = 0;
  private onWindowResize = () => this.requestBuilderFit();
  private builderPreviewReady = false;

  categories: CategoryMetadata[] = getCategories();
  availableTemplates = signal<TemplateMetadata[]>([]);

  // ---- Theme customization (Choose style → theme preset + options) ----
  availableThemes = signal<ThemePreset[]>(getThemes());
  readonly buttonStyleOptions = BUTTON_STYLE_OPTIONS;
  readonly heroStyleOptions = HERO_STYLE_OPTIONS;
  readonly galleryStyleOptions = GALLERY_STYLE_OPTIONS;
  previewThemeName = signal('');

  // ---- Create/Edit step flow (1 Business → 2 Design → 3 Media → 4 Review) ----
  readonly stepDefs = [
    { icon: 'bi-building', label: 'Business' },
    { icon: 'bi-layout-text-window-reverse', label: 'Design' },
    { icon: 'bi-images', label: 'Media' },
    { icon: 'bi-check2-square', label: 'Review' },
  ];
  currentStep = signal(1);
  stepError = signal('');
  /** While true, the category-change handler must not override templateId
   *  (used when loading an existing business so its saved template is kept). */
  private suppressTemplateAutoSelect = false;

  // ---- Template gallery thumbnails (real rendered previews) ----
  templateThumbs = signal<Record<string, string>>({});
  templateThumbState = signal<Record<string, 'idle' | 'loading' | 'ready' | 'error'>>(
    {}
  );
  /** Fingerprint of the form data a generated thumbnail was made from, so
   *  stale thumbnails are refreshed only when the data actually changed. */
  private thumbFingerprints: Record<string, string> = {};

  // ---- Live template preview ----
  previewOpen = signal(false);
  previewLoading = signal(false);
  previewError = signal('');
  previewTemplateId = signal('');
  previewTemplateName = signal('');
  private previewRef: ComponentRef<{ business: Business }> | null = null;

  @ViewChild('previewMount', { read: ViewContainerRef })
  private previewMount!: ViewContainerRef;
  @ViewChild('previewCanvas')
  private previewCanvas!: ElementRef<HTMLElement>;
  @ViewChild('previewScale')
  private previewScale!: ElementRef<HTMLElement>;

  // Builder live-preview refs
  @ViewChild('builderMount', { read: ViewContainerRef })
  private builderMount!: ViewContainerRef;
  @ViewChild('builderViewport')
  private builderViewport!: ElementRef<HTMLElement>;
  @ViewChild('builderScaleWrap')
  private builderScaleWrap!: ElementRef<HTMLElement>;
  @ViewChild('builderStageArea')
  private builderStageArea!: ElementRef<HTMLElement>;

  private environmentInjector = inject(EnvironmentInjector);

  // Smart fallback content, keyed by normalized category id. Categories
  // without a tailored copy fall back to a generic business blurb — never
  // to another category's wording (e.g. a hotel must not read "beauty
  // salon").
  private readonly genericFallback = {
    tagline: 'Professional service you can trust.',
    description:
      'We provide reliable, high-quality service tailored to your needs. Our experienced team is committed to delivering excellence in every interaction.',
  };

  private fallbacks: Record<string, { tagline: string; description: string }> = {
    salon: {
      tagline: 'Beauty, style and confidence — all in one place.',
      description:
        'We are a premium beauty salon dedicated to enhancing your natural beauty. Our expert stylists use the finest products and latest techniques to deliver an exceptional experience every time you visit.',
    },
    restaurant: {
      tagline: 'Fresh flavors, crafted with passion.',
      description:
        'We serve delicious meals prepared with the freshest ingredients. Every dish is crafted with care to bring you an unforgettable dining experience.',
    },
    gym: {
      tagline: 'Transform your body. Elevate your life.',
      description:
        'We are a modern fitness center with state-of-the-art equipment and expert trainers dedicated to helping you achieve your fitness goals.',
    },
  };

  constructor(
    private fb: FormBuilder,
    private businessService: BusinessService,
    private storageService: StorageService,
    private screenshotService: ScreenshotService,
    private subscriptionService: SubscriptionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.builderLayout.set(true);
      this.businessId.set(id);
      this.loadBusiness(id);
    }

    // Watch for form changes
    this.form.valueChanges.subscribe(() => {
      this.formPristine = false;
      if (this.builderLayout() && this.builderPreviewReady && !this.saving()) {
        this.savedState.set('dirty');
        this.scheduleBuilderPreview();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize);
    }

    // Update available templates when category changes. Only auto-selects a
    // default when the current choice no longer fits the category — never
    // when loading an existing business (suppressTemplateAutoSelect), so an
    // edit keeps the business' saved templateId.
    this.form.get('category')?.valueChanges.subscribe((category) => {
      if (category) {
        this.updateAvailableTemplates(category);
        if (!this.suppressTemplateAutoSelect) {
          const current = this.form.get('templateId')?.value;
          const stillValid = this.availableTemplates().some(
            (t) => t.id === current
          );
          if (!stillValid) {
            const defaultTemplate = getDefaultTemplateForCategory(category);
            this.form.patchValue({ templateId: defaultTemplate || '' });
          }
        }
      } else {
        this.availableTemplates.set([]);
      }
    });

    // Restrict themes to those the selected template supports. When the
    // current theme doesn't fit (e.g. template switched), fall back to the
    // template's default theme and reset style overrides.
    this.form.get('templateId')?.valueChanges.subscribe((templateId: string) => {
      if (!templateId) return;
      this.availableThemes.set(getSupportedThemesForTemplate(templateId));
      const current = this.form.get('themeId')?.value;
      if (!this.availableThemes().some((t) => t.id === current)) {
        this.form.patchValue({
          themeId: getDefaultThemeForTemplate(templateId),
          buttonStyle: '',
          heroStyle: '',
          galleryStyle: '',
        });
      }
    });

    // Live feedback: theme/style changes re-render the gallery thumbnails
    // (debounced) so the visual choice is visible without saving.
    for (const controlName of ['themeId', 'buttonStyle', 'heroStyle', 'galleryStyle']) {
      this.form.get(controlName)?.valueChanges.subscribe(() => this.scheduleThumbRefresh());
    }
  }

  private thumbRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleThumbRefresh(): void {
    const designVisible =
      this.currentStep() === 2 ||
      (this.builderLayout() && this.builderSection() === 'design');
    if (!designVisible) return;
    // Only refresh once the gallery has already produced thumbnails, so this
    // never races (or duplicates) the initial generation on step entry.
    if (Object.keys(this.templateThumbs()).length === 0) return;
    if (this.thumbRefreshTimer) clearTimeout(this.thumbRefreshTimer);
    this.thumbRefreshTimer = setTimeout(() => {
      this.thumbRefreshTimer = null;
      this.ensureTemplateThumbnails();
    }, 450);
  }

  ngOnDestroy(): void {
    this.destroyPreview();
    this.destroyBuilderPreview();
    if (this.thumbRefreshTimer) {
      clearTimeout(this.thumbRefreshTimer);
      this.thumbRefreshTimer = null;
    }
    if (this.builderPreviewTimer) {
      clearTimeout(this.builderPreviewTimer);
      this.builderPreviewTimer = null;
    }
    if (this.builderFitRaf) {
      cancelAnimationFrame(this.builderFitRaf);
      this.builderFitRaf = 0;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
    }
  }

  private updateAvailableTemplates(category: string): void {
    this.availableTemplates.set(getTemplatesForCategory(category));
    if (this.builderLayout()) {
      this.ensureTemplateThumbnails();
    }
  }

  // ============ BUILDER WORKSPACE (edit mode) ============

  /** Builder section navigation. Opening Design kicks off thumbnail renders. */
  setBuilderSection(section: 'info' | 'design' | 'content' | 'settings'): void {
    this.builderSection.set(section);
    this.panelOpen.set(false);
    if (section === 'design') {
      this.ensureTemplateThumbnails();
    }
  }

  setBuilderSectionOnKey(event: KeyboardEvent, section: 'info' | 'design' | 'content' | 'settings'): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.setBuilderSection(section);
    }
  }

  setBuilderDevice(device: 'desktop' | 'tablet' | 'mobile'): void {
    this.builderDevice.set(device);
    this.requestBuilderFit();
  }

  /** Effective (unscaled) content width of the active device frame. */
  get builderDeviceWidth(): number {
    switch (this.builderDevice()) {
      case 'tablet':
        return 768;
      case 'mobile':
        return 390;
      default:
        return 1440;
    }
  }

  get builderTemplateName(): string {
    return this.selectedTemplateMeta?.name || '';
  }

  get builderThemeName(): string {
    return (
      this.selectedThemePreset?.name ||
      getThemeDisplayName(
        this.selectedThemeId || undefined,
        getDefaultThemeForTemplate(this.selectedTemplateId || '')
      )
    );
  }

  /** Unsaved indicator for the builder top bar. */
  get builderDirty(): boolean {
    return !this.formPristine && !this.saving();
  }

  /** Debounced live re-render while the builder is open. */
  private scheduleBuilderPreview(): void {
    if (!this.builderLayout() || !this.builderPreviewReady) return;
    if (this.builderPreviewTimer) {
      clearTimeout(this.builderPreviewTimer);
      this.builderPreviewTimer = null;
    }
    this.builderPreviewTimer = setTimeout(() => {
      this.builderPreviewTimer = null;
      this.mountBuilderPreview();
    }, 450);
  }

  /** Marks local state dirty after media/logo edits (no form event fires). */
  private markUnsavedBuilderChanges(): void {
    this.formPristine = false;
    if (this.builderLayout() && !this.saving()) {
      this.savedState.set('dirty');
      this.scheduleBuilderPreview();
    }
  }

  /**
   * Persistent center-stage preview: mounts the actual selected template
   * (same component /demo/:slug resolves) with the current unsaved data and
   * the resolved theme, scaled to the active device frame.
   */
  mountBuilderPreview(): void {
    if (!this.builderLayout() || this.loading()) return;
    const mount = this.builderMount;
    if (!mount) return;

    const templateId = this.selectedTemplateId || '';
    const componentType = getTemplateComponent(templateId);
    if (!componentType || !isTemplateSupported(templateId)) {
      this.builderPreviewError.set(
        'This website design is not available. Open Design to pick another one.'
      );
      this.builderPreviewReady = false;
      return;
    }

    this.destroyBuilderPreview();
    this.builderPreviewError.set('');
    try {
      const ref = createComponent(
        componentType as Type<{ business: Business; theme?: ThemeConfig }>,
        {
          environmentInjector: this.environmentInjector,
          hostElement: mount.element.nativeElement,
        }
      );
      ref.instance.business = this.buildPreviewBusiness(templateId);
      ref.instance.theme = this.currentThemeConfig(templateId);
      ref.changeDetectorRef.detectChanges();
      this.builderRef = ref;
      this.builderPreviewReady = true;

      // Fit the frame once painted, again after images likely arrived, and
      // on window resizes (handled separately).
      setTimeout(() => this.fitBuilderPreview(), 120);
      setTimeout(() => this.fitBuilderPreview(), 1100);
      setTimeout(() => this.fitBuilderPreview(), 2400);
    } catch (err) {
      console.error('[BusinessForm] Builder preview render failed:', err);
      this.builderPreviewError.set(
        'Unable to render the live preview. Open Design and pick the template again.'
      );
      this.builderPreviewReady = false;
    }
  }

  requestBuilderFit(): void {
    if (this.builderFitRaf) return;
    this.builderFitRaf = requestAnimationFrame(() => {
      this.builderFitRaf = 0;
      this.fitBuilderPreview();
    });
  }

  /**
   * Scale the device frame so its natural width (1440/768/390) fits the
   * stage while preserving a fixed virtual viewport height: users scroll the
   * page inside the frame like a real browser.
   */
  private fitBuilderPreview(): void {
    const area = this.builderStageArea?.nativeElement;
    const viewport = this.builderViewport?.nativeElement;
    const wrap = this.builderScaleWrap?.nativeElement;
    if (!area || !viewport || !wrap || typeof window === 'undefined') return;

    const availW = area.clientWidth - 24;
    const availH = area.clientHeight - 24;
    if (availW < 80 || availH < 120) return;

    const deviceW = this.builderDeviceWidth;
    const scale = Math.min(1, availW / deviceW);
    // Virtual viewport height lives in the device's unscaled pixels.
    const vpH = Math.max(420, availH / scale);

    viewport.style.width = `${deviceW}px`;
    viewport.style.height = `${vpH}px`;
    viewport.style.transform = `scale(${scale})`;
    viewport.style.transformOrigin = 'top left';
    wrap.style.width = `${Math.floor(deviceW * scale)}px`;
    wrap.style.height = `${Math.ceil(vpH * scale)}px`;
  }

  /** Neutralize stray clicks inside the simulated browser (CTA links etc.). */
  builderPreviewClickGuard(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      target.closest?.('a, button, [role="button"], input, select, textarea, [data-lightbox]')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private destroyBuilderPreview(): void {
    if (this.builderRef) {
      try {
        this.builderRef.destroy();
      } catch {
        // Best-effort teardown.
      }
      this.builderRef = null;
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.formPristine && !this.saving()) {
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  }

  canDeactivate(): boolean {
    if (this.formPristine || this.saving()) return true;
    return confirm('You have unsaved changes. Are you sure you want to leave?');
  }

  /** Optional http(s) URL control: empty is valid, non-empty must be a URL. */
  private urlValidator: ValidatorFn = (
    control: AbstractControl
  ): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) return null;
    return isValidHttpUrl(value) ? null : { invalidUrl: true };
  };

  /** Unique id for testimonials/FAQ items (crypto when available). */
  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private initForm(): void {
    this.form = this.fb.group({
      businessName: ['', Validators.required],
      category: ['', Validators.required],
      templateId: ['salon-01', Validators.required],
      tagline: [''],
      description: [''],
      phone: [''],
      whatsapp: [''],
      address: [''],
      services: this.fb.array([]),
      testimonials: this.fb.array([]),
      faqs: this.fb.array([]),
      // Phase 3 optional features (all disabled/empty by default)
      socialLinks: this.fb.group({
        instagram: ['', this.urlValidator],
        facebook: ['', this.urlValidator],
        youtube: ['', this.urlValidator],
        linkedin: ['', this.urlValidator],
        x: ['', this.urlValidator],
      }),
      primaryCta: this.fb.group({
        enabled: [false],
        label: [''],
        actionType: ['phone'],
        value: [''],
      }),
      announcement: this.fb.group({
        enabled: [false],
        text: [''],
        linkText: [''],
        linkUrl: ['', this.urlValidator],
      }),
      status: ['draft'],
      themeId: [DEFAULT_THEME_ID],
      // Empty style controls = inherit the selected theme's preset.
      buttonStyle: [''],
      heroStyle: [''],
      galleryStyle: [''],
      // SEO settings
      seoTitle: [''],
      seoDescription: [''],
      seoKeywords: [''],
      // Website settings
      slug: [''],
      // Business hours
      businessHours: this.fb.group({
        monday: this.fb.group({ open: ['10:00'], close: ['20:00'], closed: [false] }),
        tuesday: this.fb.group({ open: ['10:00'], close: ['20:00'], closed: [false] }),
        wednesday: this.fb.group({ open: ['10:00'], close: ['20:00'], closed: [false] }),
        thursday: this.fb.group({ open: ['10:00'], close: ['20:00'], closed: [false] }),
        friday: this.fb.group({ open: ['10:00'], close: ['20:00'], closed: [false] }),
        saturday: this.fb.group({ open: ['10:00'], close: ['20:00'], closed: [false] }),
        sunday: this.fb.group({ open: ['10:00'], close: ['20:00'], closed: [true] }),
      }),
    });

    // Watch for form changes
    this.form.valueChanges.subscribe(() => {
      this.formPristine = false;
      if (this.builderLayout() && this.builderPreviewReady && !this.saving()) {
        this.savedState.set('dirty');
        this.scheduleBuilderPreview();
      }
    });
  }

  get services(): FormArray {
    return this.form.get('services') as FormArray;
  }

  private createServiceGroup(service?: ServiceItem): FormGroup {
    return this.fb.group({
      name: [service?.name || '', Validators.required],
      description: [service?.description || ''],
    });
  }

  addService(): void {
    this.services.push(this.createServiceGroup());
    // Focus the new name input after a tick
    setTimeout(() => {
      const inputs = document.querySelectorAll('.service-item .service-name-input');
      const last = inputs[inputs.length - 1] as HTMLInputElement;
      last?.focus();
    }, 0);
  }

  addServiceOnEnter(event: Event): void {
    const key = (event as KeyboardEvent).key;
    if (key === 'Enter') {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      if (input.value.trim()) {
        this.addService();
      }
    }
  }

  removeService(index: number): void {
    this.services.removeAt(index);
    this.markUnsavedBuilderChanges();
  }

  moveServiceUp(index: number): void {
    if (index <= 0) return;
    const control = this.services.at(index);
    this.services.removeAt(index);
    this.services.insert(index - 1, control);
    this.markUnsavedBuilderChanges();
  }

  moveServiceDown(index: number): void {
    if (index >= this.services.length - 1) return;
    const control = this.services.at(index);
    this.services.removeAt(index);
    this.services.insert(index + 1, control);
    this.markUnsavedBuilderChanges();
  }

  getServiceNameControl(index: number) {
    return this.services.at(index).get('name');
  }

  getServiceDescriptionControl(index: number) {
    return this.services.at(index).get('description');
  }

  /** Typed accessor for service FormGroups in templates. */
  get serviceGroups(): FormGroup[] {
    return this.services.controls as FormGroup[];
  }

  // ============ TESTIMONIALS ============

  get testimonials(): FormArray {
    return this.form.get('testimonials') as FormArray;
  }

  get testimonialGroups(): FormGroup[] {
    return this.testimonials.controls as FormGroup[];
  }

  private createTestimonialGroup(testimonial?: Testimonial): FormGroup {
    return this.fb.group({
      id: [testimonial?.id || this.generateId()],
      name: [testimonial?.name || '', Validators.required],
      role: [testimonial?.role || ''],
      quote: [testimonial?.quote || '', Validators.required],
      rating: [
        testimonial?.rating && testimonial.rating > 0 ? testimonial.rating : 5,
        [Validators.min(1), Validators.max(5)],
      ],
      imageUrl: [testimonial?.imageUrl || ''],
    });
  }

  addTestimonial(): void {
    this.testimonials.push(this.createTestimonialGroup());
    setTimeout(() => {
      const inputs = document.querySelectorAll('.testimonial-item .testimonial-name-input');
      const last = inputs[inputs.length - 1] as HTMLInputElement;
      last?.focus();
    }, 0);
  }

  removeTestimonial(index: number): void {
    this.testimonials.removeAt(index);
    this.markUnsavedBuilderChanges();
  }

  moveTestimonialUp(index: number): void {
    if (index <= 0) return;
    const control = this.testimonials.at(index);
    this.testimonials.removeAt(index);
    this.testimonials.insert(index - 1, control);
    this.markUnsavedBuilderChanges();
  }

  moveTestimonialDown(index: number): void {
    if (index >= this.testimonials.length - 1) return;
    const control = this.testimonials.at(index);
    this.testimonials.removeAt(index);
    this.testimonials.insert(index + 1, control);
    this.markUnsavedBuilderChanges();
  }

  /** Set a testimonial's rating (1–5). */
  setTestimonialRating(index: number, rating: number): void {
    const control = this.testimonials.at(index)?.get('rating');
    control?.setValue(rating);
  }

  /** Upload a photo for a testimonial (reuses the shared StorageService). */
  async onTestimonialImageChange(event: Event, index: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const validation = this.storageService.validateFile(file);
    if (!validation.valid) {
      this.errorMessage.set(validation.error!);
      input.value = '';
      return;
    }
    try {
      const businessId = this.businessId();
      if (!businessId) {
        this.errorMessage.set('Save the business once, then you can add testimonial photos.');
        input.value = '';
        return;
      }
      const url = await this.storageService.uploadImage(businessId, file);
      this.testimonials.at(index)?.patchValue({ imageUrl: url });
      this.markUnsavedBuilderChanges();
    } catch (err: any) {
      console.error('[BusinessForm] Testimonial image upload failed:', err);
      this.errorMessage.set(err?.message || 'Image upload failed. Please try again.');
    } finally {
      input.value = '';
    }
  }

  removeTestimonialImage(index: number): void {
    this.testimonials.at(index)?.patchValue({ imageUrl: '' });
    this.markUnsavedBuilderChanges();
  }

  // ============ FAQ ============

  get faqs(): FormArray {
    return this.form.get('faqs') as FormArray;
  }

  get faqGroups(): FormGroup[] {
    return this.faqs.controls as FormGroup[];
  }

  private createFaqGroup(faq?: FAQItem): FormGroup {
    return this.fb.group({
      id: [faq?.id || this.generateId()],
      question: [faq?.question || '', Validators.required],
      answer: [faq?.answer || '', Validators.required],
    });
  }

  addFaq(): void {
    this.faqs.push(this.createFaqGroup());
    setTimeout(() => {
      const inputs = document.querySelectorAll('.faq-item .faq-question-input');
      const last = inputs[inputs.length - 1] as HTMLInputElement;
      last?.focus();
    }, 0);
  }

  removeFaq(index: number): void {
    this.faqs.removeAt(index);
    this.markUnsavedBuilderChanges();
  }

  moveFaqUp(index: number): void {
    if (index <= 0) return;
    const control = this.faqs.at(index);
    this.faqs.removeAt(index);
    this.faqs.insert(index - 1, control);
    this.markUnsavedBuilderChanges();
  }

  moveFaqDown(index: number): void {
    if (index >= this.faqs.length - 1) return;
    const control = this.faqs.at(index);
    this.faqs.removeAt(index);
    this.faqs.insert(index + 1, control);
    this.markUnsavedBuilderChanges();
  }

  // ============ SOCIAL LINKS / CTA / ANNOUNCEMENT ============

  get socialLinks(): FormGroup {
    return this.form.get('socialLinks') as FormGroup;
  }

  get primaryCta(): FormGroup {
    return this.form.get('primaryCta') as FormGroup;
  }

  get announcement(): FormGroup {
    return this.form.get('announcement') as FormGroup;
  }

  socialControl(platform: string): FormControl {
    return this.socialLinks.get(platform) as FormControl;
  }

  isUrlInvalid(control: AbstractControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  /** Content sub-tab navigation. */
  setContentSection(
    section: 'services' | 'gallery' | 'testimonials' | 'faqs' | 'social' | 'cta' | 'announcement'
  ): void {
    this.contentSection.set(section);
  }

  setContentSectionOnKey(
    event: KeyboardEvent,
    section: 'services' | 'gallery' | 'testimonials' | 'faqs' | 'social' | 'cta' | 'announcement'
  ): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.setContentSection(section);
    }
  }

  private async loadBusiness(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const business = await this.businessService.getBusinessById(id);
      if (!business) {
        this.errorMessage.set('Business not found.');
        this.notFoundBusiness.set(true);
        return;
      }
      // Keep the business' saved template while patching (the category
      // valueChanges handler would otherwise swap it for the category
      // default — e.g. resetting a salon-02 business to salon-01 on edit).
      this.suppressTemplateAutoSelect = true;
      this.form.patchValue({
        businessName: business.businessName,
        category: business.category,
        templateId: business.templateId,
        tagline: business.tagline,
        description: business.description,
        phone: business.phone,
        whatsapp: business.whatsapp,
        address: business.address,
        status: business.status,
        themeId:
          business.themeId ||
          getDefaultThemeForTemplate(business.templateId || 'salon-01'),
        buttonStyle: business.themeOptions?.buttonStyle || '',
        heroStyle: business.themeOptions?.heroStyle || '',
        galleryStyle: business.themeOptions?.galleryStyle || '',
        // SEO settings
        seoTitle: business.seoTitle || '',
        seoDescription: business.seoDescription || '',
        seoKeywords: business.seoKeywords || '',
        // Website settings
        slug: business.slug || '',
        // Business hours
        businessHours: business.businessHours || {
          monday: { open: '10:00', close: '20:00', closed: false },
          tuesday: { open: '10:00', close: '20:00', closed: false },
          wednesday: { open: '10:00', close: '20:00', closed: false },
          thursday: { open: '10:00', close: '20:00', closed: false },
          friday: { open: '10:00', close: '20:00', closed: false },
          saturday: { open: '10:00', close: '20:00', closed: false },
          sunday: { open: '10:00', close: '20:00', closed: true },
        },
        // Phase 3 optional features (defaults when never configured)
        socialLinks: business.socialLinks || {
          instagram: '',
          facebook: '',
          youtube: '',
          linkedin: '',
          x: '',
        },
        primaryCta: business.primaryCta || {
          enabled: false,
          label: '',
          actionType: 'phone',
          value: '',
        },
        announcement: business.announcement || {
          enabled: false,
          text: '',
          linkText: '',
          linkUrl: '',
        },
        // Custom Domain (Phase 4)
        customDomain: business.customDomain,
      });
      this.suppressTemplateAutoSelect = false;

      // Store custom domain config for the builder UI
      if (business.customDomain) {
        this.customDomainOriginal = { ...business.customDomain };
        if (business.customDomain.status === 'pending') {
          this.customDomainStatus.set('connected');
          this.showVerificationToken.set(true);
        } else if (
          business.customDomain.status === 'verified' ||
          business.customDomain.status === 'live'
        ) {
          this.customDomainStatus.set('connected');
          this.showVerificationToken.set(false);
        }
      }

      // Populate the FormArrays (patchValue cannot create array controls).
      (business.testimonials || []).forEach((t) =>
        this.testimonials.push(this.createTestimonialGroup(t))
      );
      (business.faqs || []).forEach((f) =>
        this.faqs.push(this.createFaqGroup(f))
      );

      // Update available templates for the loaded business category
      if (business.category) {
        this.updateAvailableTemplates(business.category);
      }

      if (business.logoUrl) {
        this.logoPreview.set(business.logoUrl);
      }
      if (business.faviconUrl) {
        this.faviconPreview.set(business.faviconUrl);
      }
      if (business.socialImageUrl) {
        this.socialImagePreview.set(business.socialImageUrl);
      }
      if (business.images) {
        this.imagePreviews.set([...business.images]);
      }
      if (business.services) {
        const normalized = normalizeServices(business.services);
        normalized.forEach((s) => this.services.push(this.createServiceGroup(s)));
      }

      // Set demo URL
      const slug = business.slug || this.businessService.generateSlug(business.businessName);
      this.demoUrl.set(`${window.location.origin}/demo/${slug}`);

      // Mark form as pristine after loading
      this.formPristine = true;
      this.savedState.set('saved');
    } finally {
      this.loading.set(false);
      // Kick off the persistent live preview once the business is in the form
      // and the builder stage exists in the DOM.
      if (this.builderLayout()) {
        setTimeout(() => this.mountBuilderPreview(), 60);
      }
    }
  }

  // Logo drag & drop
  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverLogo.set(true);
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOverLogo.set(false);
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverLogo.set(false);

    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.processLogoFile(files[0]);
    }
  }

  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.processLogoFile(input.files[0]);
  }

  private processLogoFile(file: File): void {
    const validation = this.storageService.validateFile(file);
    if (!validation.valid) {
      this.errorMessage.set(validation.error!);
      return;
    }

    this.logoFile.set(file);
    this.errorMessage.set('');
    this.formPristine = false;

    const reader = new FileReader();
    reader.onload = (e) => this.logoPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
    this.markUnsavedBuilderChanges();
  }

  // Images drag & drop
  onImagesDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverImages.set(true);
  }

  onImagesDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOverImages.set(false);
  }

  onImagesDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverImages.set(false);

    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.processImageFiles(Array.from(files));
    }
  }

  onImagesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.processImageFiles(Array.from(input.files));
    input.value = '';
  }

  private processImageFiles(files: File[]): void {
    for (const file of files) {
      const validation = this.storageService.validateFile(file);
      if (!validation.valid) {
        this.errorMessage.set(validation.error!);
        return;
      }
      this.imageFiles.set([...this.imageFiles(), file]);

      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviews.set([...this.imagePreviews(), e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    }
    this.errorMessage.set('');
    this.formPristine = false;
    this.markUnsavedBuilderChanges();
  }

  removeImage(index: number): void {
    const previews = [...this.imagePreviews()];
    previews.splice(index, 1);
    this.imagePreviews.set(previews);

    if (index < this.imageFiles().length) {
      const files = [...this.imageFiles()];
      files.splice(index, 1);
      this.imageFiles.set(files);
    } else {
      const existingIndex = index - this.imageFiles().length;
      const existingImages = [...this.imagePreviews()];
      if (existingImages[existingIndex]) {
        this.removedExistingImages.set([
          ...this.removedExistingImages(),
          existingImages[existingIndex],
        ]);
      }
    }
    this.formPristine = false;
    this.markUnsavedBuilderChanges();
  }

  setAsCover(index: number): void {
    if (index === 0) return; // Already the cover

    const previews = [...this.imagePreviews()];
    const [moved] = previews.splice(index, 1);
    previews.unshift(moved);
    this.imagePreviews.set(previews);

    // Also reorder imageFiles if needed
    if (index < this.imageFiles().length) {
      const files = [...this.imageFiles()];
      const [movedFile] = files.splice(index, 1);
      files.unshift(movedFile);
      this.imageFiles.set(files);
    }
    this.formPristine = false;
    this.markUnsavedBuilderChanges();
  }

  // Favicon drag & drop
  onFaviconDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFavicon.set(true);
  }

  onFaviconDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFavicon.set(false);
  }

  onFaviconDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFavicon.set(false);

    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.processFaviconFile(files[0]);
    }
  }

  onFaviconChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.processFaviconFile(input.files[0]);
  }

  private processFaviconFile(file: File): void {
    const validation = this.storageService.validateFile(file);
    if (!validation.valid) {
      this.errorMessage.set(validation.error!);
      return;
    }

    this.faviconFile.set(file);
    this.errorMessage.set('');
    this.formPristine = false;

    const reader = new FileReader();
    reader.onload = (e) => this.faviconPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
    this.markUnsavedBuilderChanges();
  }

  removeFavicon(): void {
    this.faviconPreview.set('');
    this.faviconFile.set(null);
    this.markUnsavedBuilderChanges();
  }

  // Social image drag & drop
  onSocialImageDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverSocialImage.set(true);
  }

  onSocialImageDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverSocialImage.set(false);
  }

  onSocialImageDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverSocialImage.set(false);

    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.processSocialImageFile(files[0]);
    }
  }

  onSocialImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.processSocialImageFile(input.files[0]);
  }

  private processSocialImageFile(file: File): void {
    const validation = this.storageService.validateFile(file);
    if (!validation.valid) {
      this.errorMessage.set(validation.error!);
      return;
    }

    this.socialImageFile.set(file);
    this.errorMessage.set('');
    this.formPristine = false;

    const reader = new FileReader();
    reader.onload = (e) => this.socialImagePreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
    this.markUnsavedBuilderChanges();
  }

  removeSocialImage(): void {
    this.socialImagePreview.set('');
    this.socialImageFile.set(null);
    this.markUnsavedBuilderChanges();
  }

  // ============ PHASE 3 · SAVE-SIDE CLEANING ============

  /**
   * Sanitize testimonials for persistence: drop items without a name or
   * quote, trim strings and clamp ratings to 1–5. Returns [] (never
   * undefined) so that removing every testimonial clears the stored list.
   */
  private cleanTestimonials(list: any): Testimonial[] {
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (t) =>
          t &&
          typeof t.name === 'string' &&
          t.name.trim().length > 0 &&
          typeof t.quote === 'string' &&
          t.quote.trim().length > 0
      )
      .map((t) => {
        const rating =
          typeof t.rating === 'number' && t.rating >= 1 && t.rating <= 5
            ? Math.round(t.rating)
            : undefined;
        return {
          id: typeof t.id === 'string' && t.id ? t.id : this.generateId(),
          name: t.name.trim(),
          role: typeof t.role === 'string' && t.role.trim() ? t.role.trim() : undefined,
          quote: t.quote.trim(),
          rating,
          imageUrl:
            typeof t.imageUrl === 'string' && t.imageUrl.trim()
              ? t.imageUrl.trim()
              : undefined,
        };
      });
  }

  /**
   * Sanitize FAQs for persistence: keep only items with a question and an
   * answer. Returns [] so clearing every FAQ removes the stored list.
   */
  private cleanFaqs(list: any): FAQItem[] {
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (f) =>
          f &&
          typeof f.question === 'string' &&
          f.question.trim().length > 0 &&
          typeof f.answer === 'string' &&
          f.answer.trim().length > 0
      )
      .map((f) => ({
        id: typeof f.id === 'string' && f.id ? f.id : this.generateId(),
        question: f.question.trim(),
        answer: f.answer.trim(),
      }));
  }

  /**
   * Keep only platforms with a valid http(s) URL (trimmed). Returns {} when
   * every platform is cleared so a previous configuration is overwritten.
   */
  private cleanSocialLinks(obj: any): SocialLinks {
    const source = (obj && typeof obj === 'object' ? obj : {}) as SocialLinks;
    const cleaned: SocialLinks = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const value = source[platform];
      if (typeof value === 'string' && isValidHttpUrl(value)) {
        cleaned[platform] = value.trim();
      }
    }
    return cleaned;
  }

  /**
   * Persist the CTA config as-is when disabled (so disabling sticks) and
   * only resolve the action value when it is actually usable.
   */
  private cleanPrimaryCta(obj: any): PrimaryCta {
    const source = (obj && typeof obj === 'object' ? obj : {}) as PrimaryCta;
    const label = typeof source.label === 'string' ? source.label.trim() : '';
    if (!source.enabled || !label) {
      return { enabled: false, label: '', actionType: 'phone', value: '' };
    }
    const actionType: PrimaryCtaAction =
      source.actionType === 'phone' ||
      source.actionType === 'whatsapp' ||
      source.actionType === 'url' ||
      source.actionType === 'scroll'
        ? source.actionType
        : 'phone';
    const value = typeof source.value === 'string' ? source.value.trim() : '';
    // URL actions must be valid; scroll actions must target an existing
    // section. Invalid values fall back to the business' own contact info.
    if (actionType === 'url' && !isValidHttpUrl(value)) {
      return { enabled: true, label, actionType: 'phone', value: '' };
    }
    if (actionType === 'scroll' && !SCROLL_CTA_TARGETS.includes(value)) {
      return { enabled: true, label, actionType: 'phone', value: '' };
    }
    return { enabled: true, label, actionType, value };
  }

  /**
   * Persist the announcement config as-is when disabled (so disabling
   * sticks) and keep the link only when both label and URL are present.
   */
  private cleanAnnouncement(obj: any): AnnouncementConfig {
    const source = (obj && typeof obj === 'object' ? obj : {}) as AnnouncementConfig;
    const text = typeof source.text === 'string' ? source.text.trim() : '';
    if (!source.enabled || !text) {
      return { enabled: false, text: '', linkText: '', linkUrl: '' };
    }
    const linkText =
      typeof source.linkText === 'string' ? source.linkText.trim() : '';
    const linkUrl =
      typeof source.linkUrl === 'string' && isValidHttpUrl(source.linkUrl)
        ? source.linkUrl.trim()
        : '';
    return { enabled: true, text, linkText: linkText || undefined, linkUrl: linkUrl || undefined };
  }

  async onSubmit(status?: 'draft' | 'published'): Promise<void> {
    // Read status from the form if not explicitly passed
    const formStatus = status || this.form.get('status')?.value || 'draft';

    // Validate required fields
    if (!this.form.get('businessName')?.value?.trim()) {
      this.errorMessage.set('Business name is required.');
      return;
    }
    if (!this.form.get('category')?.value) {
      this.errorMessage.set('Category is required.');
      return;
    }

    if (formStatus === 'published') {
      // For publishing, require phone or whatsapp, and address
      const phone = this.form.get('phone')?.value;
      const whatsapp = this.form.get('whatsapp')?.value;
      const address = this.form.get('address')?.value;

      if (!phone && !whatsapp) {
        this.errorMessage.set('For publishing, please provide a phone number or WhatsApp number.');
        return;
      }
      if (!address) {
        this.errorMessage.set('For publishing, please provide a business address.');
        return;
      }
    }

    // Check if template is supported
    const templateId = this.form.get('templateId')?.value;
    if (!isTemplateSupported(templateId)) {
      this.errorMessage.set(
        `${getTemplateDisplayName(templateId)} is not available. Please select a supported template.`
      );
      return;
    }

    // Validate the optional primary CTA before saving
    const ctaValue = this.form.get('primaryCta')?.value;
    if (ctaValue?.enabled && ctaValue.label?.trim()) {
      if (ctaValue.actionType === 'url' && !isValidHttpUrl(ctaValue.value)) {
        this.errorMessage.set(
          'Primary CTA: for the URL action, enter a valid link (e.g. https://…).'
        );
        return;
      }
      if (
        ctaValue.actionType === 'scroll' &&
        (!ctaValue.value?.trim() || !SCROLL_CTA_TARGETS.includes(ctaValue.value.trim()))
      ) {
        this.errorMessage.set(
          'Primary CTA: choose an existing page section to scroll to (e.g. services, gallery, contact).'
        );
        return;
      }
    }

    // Validate the announcement link when a link label is set
    const annValue = this.form.get('announcement')?.value;
    if (annValue?.enabled && annValue.linkText?.trim() && !isValidHttpUrl(annValue.linkUrl)) {
      this.errorMessage.set(
        'Announcement: when a link label is set, the link URL must be valid (e.g. https://…).'
      );
      return;
    }

    // Plan limit enforcement (client-side check — server-side enforcement
    // happens via Cloud Functions in Part 2B)
    if (!this.isEditMode() && !this.subscriptionService.canCreateBusiness()) {
      const remaining = this.subscriptionService.getRemainingBusinessCount();
      const planName = this.subscriptionService.currentPlanMetadata().name;
      if (remaining !== null && remaining <= 0) {
        this.errorMessage.set(
          `Your ${planName} plan allows ${this.subscriptionService.formatLimit(this.subscriptionService.currentPlanLimits().maxBusinesses)} business(es). Upgrade your plan to create more.`
        );
        return;
      }
    }
    if (formStatus === 'published' && !this.isEditMode() && !this.subscriptionService.canPublishBusiness()) {
      const remaining = this.subscriptionService.getRemainingPublishedBusinessCount();
      const planName = this.subscriptionService.currentPlanMetadata().name;
      if (remaining !== null && remaining <= 0) {
        this.errorMessage.set(
          `Your ${planName} plan allows ${this.subscriptionService.formatLimit(this.subscriptionService.currentPlanLimits().maxPublishedBusinesses)} published business(es). Upgrade your plan to publish more.`
        );
        return;
      }
    }

    this.formPristine = true;
    this.savedState.set('saving');

    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    // Safety timeout: if save takes more than 30 seconds, force reset
    const safetyTimeout = setTimeout(() => {
      this.saving.set(false);
      this.errorMessage.set('The save operation took too long. Please try again.');
    }, 30000);

    try {
      const formValue = this.form.value;

      // Generate slug - use user-provided slug from Settings if available, otherwise auto-generate from business name
      const userSlug = formValue.slug?.trim();
      const baseSlug = userSlug || this.businessService.generateSlug(formValue.businessName);

      // Normalize slug format
      const normalizedSlug = this.businessService.generateSlug(baseSlug);

      // Check slug uniqueness
      let finalSlug = normalizedSlug;
      if (!this.isEditMode()) {
        const isUnique = await this.businessService.isSlugUnique(normalizedSlug);
        if (!isUnique) {
          const uniqueSlug = await this.businessService.generateUniqueSlug(normalizedSlug);
          finalSlug = uniqueSlug;
        }
      } else {
        const isUnique = await this.businessService.isSlugUnique(normalizedSlug, this.businessId());
        if (!isUnique) {
          const uniqueSlug = await this.businessService.generateUniqueSlug(normalizedSlug, this.businessId());
          finalSlug = uniqueSlug;
        }
      }

      // Apply smart fallbacks for empty tagline/description (keyed by the
      // normalized category id so legacy labels and ids resolve identically)
      const category = formValue.category;
      const fallback =
        this.fallbacks[normalizeCategoryKey(category)] ?? this.genericFallback;

      // Build business data
      // Persist only the choices: themeId + any style overrides (the full
      // palette lives in the theme registry, never duplicated per business).
      const themeOptions: ThemeOptions = {};
      if (formValue.buttonStyle) themeOptions.buttonStyle = formValue.buttonStyle;
      if (formValue.heroStyle) themeOptions.heroStyle = formValue.heroStyle;
      if (formValue.galleryStyle) themeOptions.galleryStyle = formValue.galleryStyle;

      const businessData: Partial<Business> = {
        businessName: formValue.businessName,
        // Persist the canonical registry id (normalizing any legacy label
        // such as "Salon" on the owner's next explicit save).
        category: normalizeCategoryKey(category) || category,
        templateId: formValue.templateId,
        tagline: formValue.tagline || fallback.tagline,
        description: formValue.description || fallback.description,
        phone: formValue.phone || '',
        whatsapp: formValue.whatsapp || '',
        address: formValue.address || '',
        services: formValue.services
          ?.filter((s: ServiceItem) => s?.name?.trim())
          ?.map((s: ServiceItem) => ({ name: s.name.trim(), description: s.description?.trim() || '' })) || [],
        slug: finalSlug,
        status: formStatus,
        themeId: formValue.themeId || undefined,
        themeOptions: Object.keys(themeOptions).length > 0 ? themeOptions : undefined,
        // SEO settings
        seoTitle: formValue.seoTitle?.trim() || undefined,
        seoDescription: formValue.seoDescription?.trim() || undefined,
        seoKeywords: formValue.seoKeywords?.trim() || undefined,
        // Business hours
        businessHours: formValue.businessHours || undefined,
        // ---- Phase 3 optional features (always persisted so removals stick) ----
        testimonials: this.cleanTestimonials(formValue.testimonials),
        faqs: this.cleanFaqs(formValue.faqs),
        socialLinks: this.cleanSocialLinks(formValue.socialLinks),
        primaryCta: this.cleanPrimaryCta(formValue.primaryCta),
        announcement: this.cleanAnnouncement(formValue.announcement),
      };

      // The phase-3 fields are only written when a business already exists
      // (the builder). New businesses keep the lean create payload; the
      // fields appear on the first save from the builder.
      if (!this.isEditMode()) {
        delete (businessData as any).testimonials;
        delete (businessData as any).faqs;
        delete (businessData as any).socialLinks;
        delete (businessData as any).primaryCta;
        delete (businessData as any).announcement;
      }

      let businessId = this.businessId();

      // Create or update
      if (this.isEditMode()) {
        await this.businessService.updateBusiness(businessId, businessData);
      } else {
        businessId = await this.businessService.createBusiness(businessData as Business);
        this.businessId.set(businessId);
        this.isEditMode.set(true);
      }

      // Upload logo
      if (this.logoFile()) {
        const logoUrl = await this.storageService.uploadLogo(businessId, this.logoFile()!);
        await this.businessService.updateBusiness(businessId, { logoUrl });
      }

      // Upload favicon
      if (this.faviconFile()) {
        const faviconUrl = await this.storageService.uploadImage(businessId, this.faviconFile()!);
        await this.businessService.updateBusiness(businessId, { faviconUrl });
      }

      // Upload social image
      if (this.socialImageFile()) {
        const socialImageUrl = await this.storageService.uploadImage(businessId, this.socialImageFile()!);
        await this.businessService.updateBusiness(businessId, { socialImageUrl });
      }

      // Upload new images
      const newImageUrls: string[] = [];
      for (let i = 0; i < this.imageFiles().length; i++) {
        const url = await this.storageService.uploadImage(businessId, this.imageFiles()[i]);
        newImageUrls.push(url);
      }

      // Remove deleted existing images from storage
      for (const removedUrl of this.removedExistingImages()) {
        await this.storageService.deleteFile(removedUrl);
      }

      // Only touch the images field in Firestore if images actually changed
      // (new uploads or removals) — otherwise this would re-write the same
      // unchanged image list on every save, adding an avoidable extra
      // Firestore round-trip to edits that never touched the gallery.
      if (this.imageFiles().length > 0 || this.removedExistingImages().length > 0) {
        const remainingExistingImages = this.imagePreviews()
          .slice(this.imageFiles().length)
          .filter((url) => !this.removedExistingImages().includes(url));
        const allImages = [...remainingExistingImages, ...newImageUrls];
        await this.businessService.updateBusiness(businessId, { images: allImages });
      }

      // Set demo URL
      this.demoUrl.set(`${window.location.origin}/demo/${finalSlug}`);
      this.successMessage.set(
        formStatus === 'published'
          ? 'Demo published successfully!'
          : 'Draft saved.'
      );

      // Keep the form's status in sync with what was actually saved so the
      // builder top bar (Save Draft / Publish / Update Website) stays correct
      // even when publishing from a draft state.
      const currentStatus = this.form.get('status')?.value;
      if (currentStatus !== formStatus) {
        this.form.patchValue({ status: formStatus });
      }
      this.savedState.set('saved');

      // Clear file inputs
      this.logoFile.set(null);
      this.faviconFile.set(null);
      this.socialImageFile.set(null);
      this.imageFiles.set([]);
      this.removedExistingImages.set([]);
      this.formPristine = true;

      // Refresh the persistent builder preview against the saved record
      // (uploaded images now carry real Storage URLs).
      if (this.builderLayout()) {
        setTimeout(() => this.mountBuilderPreview(), 0);
      }

      // If published, open demo after a brief delay
      if (formStatus === 'published') {
        setTimeout(() => {
          window.open(`${window.location.origin}/demo/${finalSlug}`, '_blank');
        }, 500);
      }
    } catch (err: any) {
      console.error('[SAVE] ERROR:', err);
      // Show user-friendly error
      const message = err?.message || 'Failed to save business. Please try again.';
      if (message.includes('not initialized') || message.includes('Firebase is not ready')) {
        this.errorMessage.set('Firebase is not ready. Please refresh the page and try again.');
      } else if (message.includes('Firestore database is not available') || message.includes('NOT_FOUND') || message.includes('Could not reach')) {
        this.errorMessage.set('Firestore database has not been created yet. Please go to Firebase Console → Firestore Database → Create database, then refresh this page.');
      } else if (message.includes('permission')) {
        this.errorMessage.set('You do not have permission to save businesses. Please check Firestore security rules in Firebase Console.');
      } else if (message.includes('timed out')) {
        this.errorMessage.set('The save operation timed out. This usually means the Firestore database has not been set up. Please check your Firebase Console.');
      } else {
        this.errorMessage.set('Unable to save the business. Please try again.');
      }
      this.savedState.set('dirty');
    } finally {
      clearTimeout(safetyTimeout);
      this.saving.set(false);
    }
  }

  openDemo(): void {
    window.open(this.demoUrl(), '_blank');
  }

  copyDemoUrl(): void {
    navigator.clipboard.writeText(this.demoUrl());
    this.copySuccess.set(true);
    setTimeout(() => this.copySuccess.set(false), 2000);
  }

  getTemplateLabel(templateId: string): string {
    return getTemplateDisplayName(templateId);
  }

  // ============ CATEGORY (registry-driven picker helpers) ============

  /** Friendly category name for any stored value (id or legacy label). */
  categoryNameOf(categoryId: string): string {
    return getCategoryDisplayName(categoryId);
  }

  /** Registered templates for a category (drives availability chips). */
  categoryTemplateCount(categoryId: string): number {
    return getTemplateCountForCategory(categoryId);
  }

  /** Lowercased current selection so legacy labels match registry ids. */
  get selectedCategoryId(): string {
    return normalizeCategoryKey(this.form?.get('category')?.value);
  }

  selectCategory(categoryId: string): void {
    if (this.form.get('category')?.value === categoryId) return;
    this.form.patchValue({ category: categoryId });
    this.stepError.set('');
  }

  selectCategoryOnKey(event: KeyboardEvent, categoryId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectCategory(categoryId);
    }
  }

  isFieldInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  /** Template-aware labels for Content panel (Services vs Menu/Offerings). */
  contentLabel(type: 'services' | 'gallery'): string {
    const category = normalizeCategoryKey(this.form?.get('category')?.value);
    if (type === 'services') {
      // Restaurant templates use "Menu" / "Offerings"
      if (category === 'restaurant') return 'Menu / Offerings';
      // Default generic label
      return 'Services / Offerings';
    }
    if (type === 'gallery') {
      return 'Gallery';
    }
    return '';
  }

  /** Confirm before removing an image from gallery. */
  confirmRemoveImage(index: number): void {
    if (confirm('Remove this image from the gallery? This cannot be undone.')) {
      this.removeImage(index);
    }
  }

  /** Confirm before removing the logo. */
  confirmRemoveLogo(): void {
    if (confirm('Remove the current logo? This cannot be undone.')) {
      this.removeLogo();
    }
  }

  /** Remove the current logo. */
  removeLogo(): void {
    this.logoPreview.set('');
    this.logoFile.set(null);
    this.markUnsavedBuilderChanges();
  }

  // ============ CUSTOM DOMAIN METHODS (Phase 4) ============

  /** Get the current custom domain config from the loaded business. */
  get currentCustomDomain(): CustomDomainConfig | undefined {
    const cd = this.customDomainOriginal;
    if (cd) return cd;
    // Fallback: read from form if not loaded yet (edit mode initial load)
    return this.form?.get('customDomain')?.value;
  }

  /** Whether a custom domain is configured (any status). */
  get hasCustomDomain(): boolean {
    return !!this.currentCustomDomain?.domain;
  }

  /** Whether the custom domain is verified and active. */
  get isCustomDomainVerified(): boolean {
    return isCustomDomainActive(this.currentCustomDomain);
  }

  /** Custom domain display label. */
  get customDomainLabel(): string {
    const cd = this.currentCustomDomain;
    if (!cd?.domain) return '';
    const statusLabels: Record<string, string> = {
      pending: 'Pending verification',
      verified: 'Ownership verified',
      live: 'Live',
      disabled: 'Disabled',
    };
    return `${cd.domain} · ${statusLabels[cd.status] || cd.status}`;
  }

  /** Input validation for custom domain field. */
  validateCustomDomainInput(): boolean {
    const input = this.customDomainInput().trim();
    if (!input) {
      this.customDomainError.set('Please enter a domain name.');
      return false;
    }
    const normalized = normalizeDomain(input);
    if (!normalized || !isValidDomainHostname(normalized)) {
      this.customDomainError.set('Invalid domain format. Use a hostname like example.com or www.example.com');
      return false;
    }
    // Check if it's the same as current
    if (normalized === this.currentCustomDomain?.domain) {
      this.customDomainError.set('This domain is already connected.');
      return false;
    }
    this.customDomainError.set('');
    return true;
  }

  /** Connect a custom domain - validates and saves. */
  async connectCustomDomain(): Promise<void> {
    if (!this.validateCustomDomainInput()) return;
    if (!this.businessId()) {
      this.customDomainError.set('Save the business first before connecting a domain.');
      return;
    }

    this.customDomainStatus.set('checking');
    this.customDomainError.set('');

    try {
      const config = await this.businessService.connectCustomDomain(
        this.businessId(),
        this.customDomainInput()
      );
      this.customDomainOriginal = config;
      this.customDomainInput.set('');
      this.customDomainStatus.set('connected');
      this.showVerificationToken.set(true);
      this.successMessage.set('Custom domain connected. Add the TXT record to verify.');
    } catch (err: any) {
      this.customDomainStatus.set('error');
      this.customDomainError.set(err?.message || 'Failed to connect domain. Please try again.');
    }
  }

  /** Verify the custom domain via server-side DNS TXT record check. */
  async verifyCustomDomain(): Promise<void> {
    if (!this.businessId()) return;

    this.customDomainVerifying.set(true);
    this.customDomainError.set('');

    try {
      // Calls the Cloud Function which performs secure DNS verification
      const config = await this.businessService.verifyCustomDomain(this.businessId());
      this.customDomainOriginal = config;
      this.showVerificationToken.set(false);
      this.customDomainStatus.set('connected');
      this.successMessage.set('Custom domain verified! Your site is now live at your domain.');
    } catch (err: any) {
      const message = err?.message || '';
      // Provide user-friendly messages for common error codes
      if (message.includes('verification record')) {
        this.customDomainError.set(
          'We couldn\'t find the verification record yet. DNS changes can take time to propagate. Please wait a few minutes and try again.'
        );
      } else if (message.includes('DNS') || message.includes('unavailable')) {
        this.customDomainError.set(
          'Unable to check DNS right now. Please try again later.'
        );
      } else if (message.includes('already verified')) {
        this.customDomainError.set('This domain is already verified.');
      } else if (message.includes('another business')) {
        this.customDomainError.set('This domain is already verified for another business.');
      } else {
        this.customDomainError.set(message || 'Verification failed. Please try again.');
      }
    } finally {
      this.customDomainVerifying.set(false);
    }
  }

  /**
   * Ask the server to probe the verified domain over HTTPS and mark it
   * 'live' when the application demonstrably serves this business' published
   * demo on the domain. Ownership verification (TXT) alone never means the
   * domain is live: the operator must first add the domain to Firebase
   * Hosting and point its DNS at Firebase Hosting.
   */
  async checkCustomDomainLive(): Promise<void> {
    if (!this.businessId()) return;
    this.customDomainLiveChecking.set(true);
    this.customDomainLiveResult.set('');
    try {
      const result = await this.businessService.checkCustomDomainLive(
        this.businessId()
      );
      if (result.live) {
        // Refresh the stored config so the badge switches to Live.
        const business = await this.businessService.getBusinessById(
          this.businessId()
        );
        if (business?.customDomain) {
          this.customDomainOriginal = { ...business.customDomain };
        }
        this.customDomainLiveResult.set(
          result.message || 'Live! The domain is serving this business.'
        );
      } else {
        this.customDomainLiveResult.set(
          result.message ||
            'Not live yet. Add the domain to Firebase Hosting and point DNS at it, then check again.'
        );
      }
    } catch (err: any) {
      this.customDomainLiveResult.set(
        err?.message || 'Live check failed. Please try again.'
      );
    } finally {
      this.customDomainLiveChecking.set(false);
    }
  }

  /** Disconnect the custom domain. */
  async disconnectCustomDomain(): Promise<void> {
    if (!this.businessId()) return;
    if (!confirm('Disconnect this custom domain? This will remove the domain connection and visitors will only be able to access your site via the demo URL.')) {
      return;
    }

    this.customDomainError.set('');

    try {
      await this.businessService.disconnectCustomDomain(this.businessId());
      this.customDomainOriginal = null;
      this.customDomainStatus.set('idle');
      this.showVerificationToken.set(false);
      this.successMessage.set('Custom domain disconnected.');
    } catch (err: any) {
      this.customDomainError.set(err?.message || 'Failed to disconnect domain. Please try again.');
    }
  }

  /** Toggle showing the verification token. */
  toggleVerificationToken(): void {
    this.showVerificationToken.set(!this.showVerificationToken());
  }

  /** Get the verification TXT host. */
  get verificationTxtHost(): string {
    return VERIFICATION_TXT_HOST;
  }

  /** Get the verification TXT value. */
  get verificationTxtValue(): string {
    const token = this.currentCustomDomain?.verificationToken;
    return token ? getVerificationTxtValue(token) : '';
  }

  /** Copy verification token to clipboard. */
  copyVerificationToken(): void {
    navigator.clipboard.writeText(this.verificationTxtValue).then(() => {
      this.successMessage.set('Verification token copied to clipboard.');
    }).catch(() => {
      this.errorMessage.set('Failed to copy token.');
    });
  }

  /** Origin for slug display (safe for SSR). */
  get windowLocationOrigin(): string {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  // ============ BUSINESS HOURS HELPERS ============

  /** Ordered days for the hours editor. */
  readonly hourDays: { key: keyof BusinessHours; label: string }[] = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  /** Get the FormGroup for a specific day's hours. */
  getHoursControl(day: keyof BusinessHours): FormGroup {
    return this.form.get('businessHours')?.get(day) as FormGroup;
  }

  /** Toggle a day's open/closed state. */
  toggleDayClosed(day: keyof BusinessHours): void {
    const control = this.getHoursControl(day);
    const currentlyClosed = control.get('closed')?.value;
    control.patchValue({ closed: !currentlyClosed });
    this.markUnsavedBuilderChanges();
  }

  // ============ STEP FLOW ============

  get selectedTemplateId(): string {
    return this.form.get('templateId')?.value || '';
  }

  get selectedTemplateMeta(): TemplateMetadata | null {
    const id = this.selectedTemplateId;
    return this.availableTemplates().find((t) => t.id === id) || null;
  }

  get categoryTemplatesHeading(): string {
    const category = this.form.get('category')?.value;
    return category
      ? `${this.categoryNameOf(category)} Templates`
      : 'Your Templates';
  }

  /** Move to another step. Forward moves run validation on the step being left. */
  goToStep(target: number): void {
    if (this.saving() || this.loading()) return;
    const current = this.currentStep();
    if (target > current && !this.validateStep(current)) {
      return;
    }
    this.currentStep.set(target);
    this.stepError.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Kick off real template previews when the gallery becomes visible.
    if (target === 2) {
      this.ensureTemplateThumbnails();
    }
  }

  // ============ TEMPLATE GALLERY THUMBNAILS ============

  /**
   * Best visual for a template card: a static registry asset when the
   * template ships one, otherwise the live generated thumbnail. Falls back
   * to null so the card can show its styled placeholder while rendering.
   */
  thumbFor(tpl: TemplateMetadata): string | null {
    if (tpl.thumbnail) return tpl.thumbnail;
    return this.templateThumbs()[tpl.id] || null;
  }

  thumbStateOf(templateId: string): string {
    return this.templateThumbState()[templateId] || 'idle';
  }

  /**
   * Generate (or refresh stale) real thumbnails for every template in the
   * current category. Static-asset templates skip rendering; generated ones
   * are gated by a fingerprint so revisiting the step is cheap.
   */
  private ensureTemplateThumbnails(): void {
    if (this.loading()) return;
    for (const tpl of this.availableTemplates()) {
      if (tpl.thumbnail) continue;
      const state = this.templateThumbState()[tpl.id];
      if (state === 'loading') continue;
      if (state === 'ready' && this.thumbFingerprints[tpl.id] === this.thumbFingerprint()) {
        continue;
      }
      this.generateThumbnail(tpl.id);
    }
  }

  /** Force a thumbnail to re-render (used by the per-card refresh button). */
  regenerateThumbnail(templateId: string): void {
    delete this.thumbFingerprints[templateId];
    this.generateThumbnail(templateId);
  }

  private generateThumbnail(templateId: string): void {
    this.templateThumbState.update((s) => ({ ...s, [templateId]: 'loading' }));
    const business = this.buildPreviewBusiness(templateId);
    this.screenshotService
      .generateThumbnail(business)
      .then((dataUrl) => {
        this.templateThumbs.update((t) => ({ ...t, [templateId]: dataUrl }));
        this.thumbFingerprints[templateId] = this.thumbFingerprint();
        this.templateThumbState.update((s) => ({ ...s, [templateId]: 'ready' }));
      })
      .catch((err) => {
        console.error('[BusinessForm] Thumbnail render failed for', templateId, err);
        this.templateThumbState.update((s) => ({ ...s, [templateId]: 'error' }));
      });
  }

  /** Cheap signature of the form data that affects a rendered page. */
  private thumbFingerprint(): string {
    const v = this.form?.value ?? {};
    return [
      v.businessName,
      v.tagline,
      v.description,
      v.category,
      v.themeId,
      v.buttonStyle,
      v.heroStyle,
      v.galleryStyle,
      this.logoPreview(),
      this.imagePreviews()[0] || '',
      (v.services || []).length,
      // Phase 3 features render on the page, so include them or thumbnails
      // would go stale after editing testimonials/FAQ/social/CTA/announcement.
      JSON.stringify(this.cleanTestimonials(v.testimonials)),
      JSON.stringify(this.cleanFaqs(v.faqs)),
      JSON.stringify(this.cleanSocialLinks(v.socialLinks)),
      JSON.stringify(this.cleanPrimaryCta(v.primaryCta)),
      JSON.stringify(this.cleanAnnouncement(v.announcement)),
    ].join('|');
  }

  // ============ THEME CUSTOMIZATION ============

  get selectedThemeId(): string {
    return this.form.get('themeId')?.value || '';
  }

  get selectedThemePreset(): ThemePreset | null {
    return getThemeById(this.selectedThemeId) || null;
  }

  selectTheme(themeId: string): void {
    // Picking a theme also resets style overrides so the new theme's
    // presets apply (re-select a theme to clear a previous customization).
    this.form.patchValue({
      themeId,
      buttonStyle: '',
      heroStyle: '',
      galleryStyle: '',
    });
    this.stepError.set('');
  }

  selectThemeOnKey(event: KeyboardEvent, themeId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectTheme(themeId);
    }
  }

  /** Effective style = explicit override, else the theme's preset. */
  effectiveButtonStyle(): ButtonStyle {
    return (
      (this.form.get('buttonStyle')?.value as ButtonStyle) ||
      this.selectedThemePreset?.buttonStyle ||
      'soft'
    );
  }

  effectiveHeroStyle(): HeroStyle {
    return (
      (this.form.get('heroStyle')?.value as HeroStyle) ||
      this.selectedThemePreset?.heroStyle ||
      'split'
    );
  }

  effectiveGalleryStyle(): GalleryStyle {
    return (
      (this.form.get('galleryStyle')?.value as GalleryStyle) ||
      this.selectedThemePreset?.galleryStyle ||
      'editorial'
    );
  }

  setButtonStyle(style: ButtonStyle): void {
    this.form.patchValue({ buttonStyle: style });
  }

  setHeroStyle(style: HeroStyle): void {
    this.form.patchValue({ heroStyle: style });
  }

  setGalleryStyle(style: GalleryStyle): void {
    this.form.patchValue({ galleryStyle: style });
  }

  /** Persisted subset of choices (only explicit overrides). */
  private currentThemeOptions(): ThemeOptions {
    const options: ThemeOptions = {};
    const buttonStyle = this.form.get('buttonStyle')?.value;
    const heroStyle = this.form.get('heroStyle')?.value;
    const galleryStyle = this.form.get('galleryStyle')?.value;
    if (buttonStyle) options.buttonStyle = buttonStyle;
    if (heroStyle) options.heroStyle = heroStyle;
    if (galleryStyle) options.galleryStyle = galleryStyle;
    return options;
  }

  /** Full resolved theme for the current form state + a template. */
  private currentThemeConfig(templateId: string): ThemeConfig {
    return resolveThemeConfig(
      this.selectedThemeId || undefined,
      this.currentThemeOptions(),
      getDefaultThemeForTemplate(templateId)
    );
  }

  private validateStep(step: number): boolean {
    if (step === 1) {
      if (!this.form.get('businessName')?.value?.trim()) {
        this.stepError.set('Please enter a business name before continuing.');
        return false;
      }
      if (!this.form.get('category')?.value) {
        this.stepError.set('Please select a business category before continuing.');
        return false;
      }
    }
    if (step === 2) {
      const templateId = this.selectedTemplateId;
      if (!templateId || !isTemplateSupported(templateId)) {
        this.stepError.set('Please choose a website design before continuing.');
        return false;
      }
    }
    return true;
  }

  selectTemplate(templateId: string): void {
    this.form.patchValue({ templateId });
    this.stepError.set('');
  }

  /**
   * Saving only happens through the explicit Save Draft / Publish buttons on
   * the Review step. Enter-key submissions (implicit form submits from text
   * inputs) are intentionally swallowed so typing never saves mid-wizard.
   */
  stepSubmitGuard(event: Event): void {
    event.preventDefault();
  }

  selectTemplateOnKey(event: KeyboardEvent, templateId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectTemplate(templateId);
    }
  }

  isStepDone(step: number): boolean {
    return this.currentStep() > step;
  }

  // ============ LIVE TEMPLATE PREVIEW ============

  /**
   * Mounts the chosen template inside the preview modal and renders it with
   * the CURRENT form data (name, tagline, description, contact, logo and
   * images) so the owner sees exactly what their site will look like.
   * Unsupported/unknown ids degrade to a friendly message.
   */
  previewTemplate(templateId: string): void {
    this.previewTemplateId.set(templateId);
    this.previewTemplateName.set(getTemplateDisplayName(templateId));
    this.previewThemeName.set(
      getThemeDisplayName(
        this.selectedThemeId || undefined,
        getDefaultThemeForTemplate(templateId)
      )
    );
    this.previewLoading.set(true);
    this.previewError.set('');
    this.previewOpen.set(true);
    // The modal + host container need a tick to exist before mounting.
    setTimeout(() => this.buildPreview(), 0);
  }

  closePreview(): void {
    this.destroyPreview();
    this.previewOpen.set(false);
    this.previewError.set('');
  }

  refreshPreview(): void {
    this.previewLoading.set(true);
    this.previewError.set('');
    setTimeout(() => this.buildPreview(), 0);
  }

  @HostListener('document:keydown.escape')
  onPreviewEscape(): void {
    if (this.previewOpen()) {
      this.closePreview();
    } else if (this.panelOpen()) {
      this.panelOpen.set(false);
    }
  }

  private buildPreview(): void {
    this.destroyPreview();
    if (!this.previewOpen()) return;

    const templateId = this.previewTemplateId();
    const canvas = this.previewCanvas?.nativeElement;
    const scaleWrap = this.previewScale?.nativeElement;
    const host = this.previewMount;

    if (!host || !canvas || !scaleWrap) {
      this.previewError.set('The preview area is not ready yet. Please try again.');
      this.previewLoading.set(false);
      return;
    }

    const componentType = getTemplateComponent(templateId);
    if (!componentType || !isTemplateSupported(templateId)) {
      this.previewError.set('This design is not available yet. Please choose another one.');
      this.previewLoading.set(false);
      return;
    }

    try {
      const business = this.buildPreviewBusiness(templateId);
      canvas.style.transform = '';
      scaleWrap.style.width = '';
      scaleWrap.style.height = '';

      const ref = createComponent(
        componentType as Type<{ business: Business; theme?: ThemeConfig }>,
        {
          environmentInjector: this.environmentInjector,
          hostElement: host.element.nativeElement,
        }
      );
      ref.instance.business = business;
      ref.instance.theme = this.currentThemeConfig(templateId);
      ref.changeDetectorRef.detectChanges();
      this.previewRef = ref;

      // Let the template paint, then fit the desktop-width frame into the
      // dialog (scale-to-fit). A transform ancestor also re-parents any
      // position:fixed header/lightbox to the preview frame, so they stay
      // inside the preview instead of escaping onto the admin page.
      setTimeout(() => {
        this.previewLoading.set(false);
        this.fitPreview();
      }, 120);
      // Late-loading images can change the frame's height — re-fit once
      // they have had time to arrive.
      setTimeout(() => {
        if (this.previewOpen()) {
          this.fitPreview();
        }
      }, 900);
    } catch (err) {
      console.error('[BusinessForm] Template preview failed:', err);
      this.previewError.set('Unable to render this design preview. Please try another design.');
      this.previewLoading.set(false);
    }
  }

  private fitPreview(): void {
    const canvas = this.previewCanvas?.nativeElement;
    const scaleWrap = this.previewScale?.nativeElement;
    if (!canvas || !scaleWrap || typeof window === 'undefined') return;

    const naturalWidth = 1280;
    const available = scaleWrap.clientWidth || window.innerWidth - 96;
    const scale = Math.min(1, available / naturalWidth);
    const height = Math.max(canvas.offsetHeight, 200);

    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = 'top left';
    scaleWrap.style.width = `${Math.floor(naturalWidth * scale)}px`;
    scaleWrap.style.height = `${Math.ceil(height * scale)}px`;
  }

  private destroyPreview(): void {
    if (this.previewRef) {
      try {
        this.previewRef.destroy();
      } catch {
        // Ignore teardown errors — the preview is best-effort.
      }
      this.previewRef = null;
    }
  }

  /**
   * Assemble a Business from the current form state (same fallback content
   * rules as save) so the preview reflects what would be published.
   */
  private buildPreviewBusiness(templateId: string): Business {
    const value = this.form.value;
    const categoryRaw = value.category || 'Salon';
    const fallback =
      this.fallbacks[normalizeCategoryKey(categoryRaw)] ?? this.genericFallback;

    const business: Business = {
      ownerId: '',
      businessName: value.businessName?.trim() || 'Your Business Name',
      category: categoryRaw,
      templateId,
      tagline: value.tagline?.trim() || fallback.tagline,
      description: value.description?.trim() || fallback.description,
      phone: value.phone || '',
      whatsapp: value.whatsapp || '',
      address: value.address || '',
      services:
        value.services
          ?.filter((s: ServiceItem) => s?.name?.trim())
          ?.map((s: ServiceItem) => ({ name: s.name.trim(), description: s.description?.trim() || '' })) || [],
      slug: this.businessService.generateSlug(
        value.businessName?.trim() || 'business'
      ),
      status: 'draft',
      themeId: this.selectedThemeId || undefined,
      themeOptions: this.currentThemeOptions(),
      // SEO settings
      seoTitle: value.seoTitle?.trim() || undefined,
      seoDescription: value.seoDescription?.trim() || undefined,
      seoKeywords: value.seoKeywords?.trim() || undefined,
      // Website settings
      socialImageUrl: this.socialImagePreview() || undefined,
      faviconUrl: this.faviconPreview() || undefined,
      // Business hours
      businessHours: value.businessHours || undefined,
      // Phase 3 optional features (same cleaning as save, so the preview
      // matches exactly what would be published).
      testimonials: this.cleanTestimonials(value.testimonials),
      faqs: this.cleanFaqs(value.faqs),
      socialLinks: this.cleanSocialLinks(value.socialLinks),
      primaryCta: this.cleanPrimaryCta(value.primaryCta),
      announcement: this.cleanAnnouncement(value.announcement),
    };

    if (this.logoPreview()) {
      business.logoUrl = this.logoPreview();
    }
    if (this.imagePreviews().length > 0) {
      business.images = [...this.imagePreviews()];
    }
    return business;
  }
}
