import { Component, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule, CanDeactivate } from '@angular/router';
import { BusinessService } from '../../../services/business.service';
import { StorageService } from '../../../services/storage.service';
import { Business } from '../../../models/business.model';

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
  copySuccess = signal(false);
  private formPristine = true;

  categories = ['Salon', 'Restaurant', 'Gym', 'Local Service'];
  templates = [
    { id: 'salon-01', label: 'Salon 01', available: true },
    { id: 'restaurant-01', label: 'Restaurant 01', available: false },
    { id: 'gym-01', label: 'Gym 01', available: false },
    { id: 'local-service-01', label: 'Local Service 01', available: false },
  ];

  // Smart fallback content
  private fallbacks: Record<string, { tagline: string; description: string }> = {
    Salon: {
      tagline: 'Beauty, style and confidence — all in one place.',
      description:
        'We are a premium beauty salon dedicated to enhancing your natural beauty. Our expert stylists use the finest products and latest techniques to deliver an exceptional experience every time you visit.',
    },
    Restaurant: {
      tagline: 'Fresh flavors, crafted with passion.',
      description:
        'We serve delicious meals prepared with the freshest ingredients. Every dish is crafted with care to bring you an unforgettable dining experience.',
    },
    Gym: {
      tagline: 'Transform your body. Elevate your life.',
      description:
        'We are a modern fitness center with state-of-the-art equipment and expert trainers dedicated to helping you achieve your fitness goals.',
    },
    'Local Service': {
      tagline: 'Professional service you can trust.',
      description:
        'We provide reliable, high-quality local services tailored to your needs. Our experienced team is committed to delivering excellence in every interaction.',
    },
  };

  constructor(
    private fb: FormBuilder,
    private businessService: BusinessService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.businessId.set(id);
      this.loadBusiness(id);
    }

    // Watch for form changes
    this.form.valueChanges.subscribe(() => {
      this.formPristine = false;
    });
  }

  ngOnDestroy(): void {
    // Nothing to clean up
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
      status: ['draft'],
    });

    // Watch for form changes
    this.form.valueChanges.subscribe(() => {
      this.formPristine = false;
    });
  }

  get services(): FormArray {
    return this.form.get('services') as FormArray;
  }

  addService(): void {
    this.services.push(this.fb.control(''));
  }

  addServiceOnEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      if (input.value.trim()) {
        this.services.push(this.fb.control(''));
        // Focus the new input after a tick
        setTimeout(() => {
          const inputs = document.querySelectorAll('.service-item input');
          const last = inputs[inputs.length - 1] as HTMLInputElement;
          last?.focus();
        }, 0);
      }
    }
  }

  removeService(index: number): void {
    this.services.removeAt(index);
  }

  private async loadBusiness(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const business = await this.businessService.getBusinessById(id);
      if (!business) {
        this.errorMessage.set('Business not found.');
        return;
      }
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
      });

      if (business.logoUrl) {
        this.logoPreview.set(business.logoUrl);
      }
      if (business.images) {
        this.imagePreviews.set([...business.images]);
      }
      if (business.services) {
        business.services.forEach((s) => this.services.push(this.fb.control(s)));
      }

      // Set demo URL
      const slug = business.slug || this.businessService.generateSlug(business.businessName);
      this.demoUrl.set(`${window.location.origin}/demo/${slug}`);

      // Mark form as pristine after loading
      this.formPristine = true;
    } finally {
      this.loading.set(false);
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
  }

  async onSubmit(status?: 'draft' | 'published'): Promise<void> {
    console.log('[SAVE] onSubmit started, status:', status || 'form-default');

    // Read status from the form if not explicitly passed
    const formStatus = status || this.form.get('status')?.value || 'draft';
    console.log('[SAVE] Form status:', formStatus);

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

    // Check if template is available
    const templateId = this.form.get('templateId')?.value;
    const template = this.templates.find((t) => t.id === templateId);
    if (template && !template.available) {
      this.errorMessage.set(
        `${template.label} is coming soon. Please select an available template.`
      );
      return;
    }

    this.formPristine = true;

    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    // Safety timeout: if save takes more than 30 seconds, force reset
    const safetyTimeout = setTimeout(() => {
      console.error('[SAVE] Safety timeout triggered — save took too long!');
      this.saving.set(false);
      this.errorMessage.set('The save operation took too long. Please try again.');
    }, 30000);

    try {
      console.log('[SAVE] Step 1: Form valid, preparing data...');
      const formValue = this.form.value;

      // Generate slug
      const slug = this.businessService.generateSlug(formValue.businessName);
      console.log('[SAVE] Step 2: Slug generated:', slug);

      // Check slug uniqueness
      let finalSlug = slug;
      if (!this.isEditMode()) {
        console.log('[SAVE] Step 3: Checking slug uniqueness...');
        const isUnique = await this.businessService.isSlugUnique(slug);
        console.log('[SAVE] Step 3: Slug unique:', isUnique);
        if (!isUnique) {
          const uniqueSlug = await this.businessService.generateUniqueSlug(slug);
          finalSlug = uniqueSlug;
          console.log('[SAVE] Step 3: Unique slug generated:', uniqueSlug);
        }
      } else {
        console.log('[SAVE] Step 3: Checking slug uniqueness (edit mode)...');
        const isUnique = await this.businessService.isSlugUnique(slug, this.businessId());
        console.log('[SAVE] Step 3: Slug unique:', isUnique);
        if (!isUnique) {
          const uniqueSlug = await this.businessService.generateUniqueSlug(slug, this.businessId());
          finalSlug = uniqueSlug;
          console.log('[SAVE] Step 3: Unique slug generated:', uniqueSlug);
        }
      }

      // Apply smart fallbacks for empty tagline/description
      const category = formValue.category;
      const fallback = this.fallbacks[category] || this.fallbacks['Salon'];

      // Build business data
      const businessData: Partial<Business> = {
        businessName: formValue.businessName,
        category: formValue.category,
        templateId: formValue.templateId,
        tagline: formValue.tagline || fallback.tagline,
        description: formValue.description || fallback.description,
        phone: formValue.phone || '',
        whatsapp: formValue.whatsapp || '',
        address: formValue.address || '',
        services: formValue.services?.filter((s: string) => s.trim()) || [],
        slug: finalSlug,
        status: formStatus,
      };

      console.log('[SAVE] Step 4: Business data prepared');

      let businessId = this.businessId();

      // Create or update
      if (this.isEditMode()) {
        console.log('[SAVE] Step 5: Updating Firestore document, ID:', businessId);
        await this.businessService.updateBusiness(businessId, businessData);
        console.log('[SAVE] Step 5: Firestore document updated');
      } else {
        console.log('[SAVE] Step 5: Creating Firestore document...');
        businessId = await this.businessService.createBusiness(businessData as Business);
        this.businessId.set(businessId);
        this.isEditMode.set(true);
        console.log('[SAVE] Step 5: Firestore document created, ID:', businessId);
      }

      // Upload logo
      if (this.logoFile()) {
        console.log('[SAVE] Step 6: Logo upload started...');
        const logoUrl = await this.storageService.uploadLogo(businessId, this.logoFile()!);
        console.log('[SAVE] Step 6: Logo upload completed, updating Firestore...');
        await this.businessService.updateBusiness(businessId, { logoUrl });
        console.log('[SAVE] Step 6: Firestore updated with logo URL');
      } else {
        console.log('[SAVE] Step 6: No logo to upload, skipping');
      }

      // Upload new images
      console.log('[SAVE] Step 7: Processing gallery images...');
      const newImageUrls: string[] = [];
      for (let i = 0; i < this.imageFiles().length; i++) {
        console.log(`[SAVE] Step 7: Uploading image ${i + 1} of ${this.imageFiles().length}...`);
        const url = await this.storageService.uploadImage(businessId, this.imageFiles()[i]);
        newImageUrls.push(url);
        console.log(`[SAVE] Step 7: Image ${i + 1} uploaded`);
      }

      // Remove deleted existing images from storage
      console.log('[SAVE] Step 8: Removing deleted images from storage...');
      for (const removedUrl of this.removedExistingImages()) {
        await this.storageService.deleteFile(removedUrl);
      }

      // Collect remaining images
      const remainingExistingImages = this.imagePreviews()
        .slice(this.imageFiles().length)
        .filter((url) => !this.removedExistingImages().includes(url));
      const allImages = [...remainingExistingImages, ...newImageUrls];

      if (allImages.length > 0 || this.removedExistingImages().length > 0) {
        console.log('[SAVE] Step 9: Updating Firestore with images array...');
        await this.businessService.updateBusiness(businessId, { images: allImages });
        console.log('[SAVE] Step 9: Firestore updated with images');
      } else {
        console.log('[SAVE] Step 9: No image changes to save');
      }

      // Set demo URL
      this.demoUrl.set(`${window.location.origin}/demo/${finalSlug}`);
      this.successMessage.set(
        formStatus === 'published'
          ? 'Demo published successfully!'
          : 'Draft saved.'
      );

      // Clear file inputs
      this.logoFile.set(null);
      this.imageFiles.set([]);
      this.removedExistingImages.set([]);
      this.formPristine = true;

      console.log('[SAVE] Step 10: Save completed successfully!');

      // If published, open demo after a brief delay
      if (formStatus === 'published') {
        setTimeout(() => {
          window.open(`${window.location.origin}/demo/${finalSlug}`, '_blank');
        }, 500);
      }
    } catch (err: any) {
      console.error('[SAVE] ERROR:', err);
      console.error('[SAVE] ERROR code:', err?.code);
      console.error('[SAVE] ERROR message:', err?.message);
      console.error('[SAVE] ERROR name:', err?.name);
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
    } finally {
      clearTimeout(safetyTimeout);
      console.log('[SAVE] Finally: setting saving = false');
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
    return this.templates.find((t) => t.id === templateId)?.label || templateId;
  }

  isFieldInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }
}
