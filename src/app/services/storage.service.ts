import { Injectable, signal } from '@angular/core';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTask,
} from 'firebase/storage';
import { getApps } from 'firebase/app';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private storage: ReturnType<typeof getStorage> | undefined;
  private storageInitialized = false;

  uploading = signal(false);
  progress = signal(0);

  constructor(private authService: AuthService) {
    // Do NOT initialize Storage here — Firebase may not be ready yet.
    // Use lazy init via getStorageInstance().
  }

  /**
   * Lazily initialize and return the Firebase Storage instance.
   */
  private getStorageInstance() {
    if (this.storage && this.storageInitialized) {
      return this.storage;
    }

    try {
      const apps = getApps();
      if (apps.length === 0) {
        throw new Error('Firebase app not initialized');
      }
      this.storage = getStorage(apps[0]);
      this.storageInitialized = true;
      return this.storage;
    } catch (err) {
      console.error('[StorageService] Failed to initialize Storage:', err);
      throw new Error('Firebase Storage is not initialized. Please refresh the page and try again.');
    }
  }

  validateFile(file: File): { valid: boolean; error?: string } {
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'Only image files are allowed.' };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: 'File size must be less than 5 MB.' };
    }
    return { valid: true };
  }

  async uploadLogo(businessId: string, file: File): Promise<string> {
    const validation = this.validateFile(file);
    if (!validation.valid) throw new Error(validation.error);

    this.uploading.set(true);
    this.progress.set(0);

    try {
      const storage = this.getStorageInstance();
      const path = `businesses/${businessId}/logo`;
      const storageRef = ref(storage, path);
      const task: UploadTask = uploadBytesResumable(storageRef, file);

      return new Promise<string>((resolve, reject) => {
        // Set a timeout so the upload never hangs forever
        const timeout = setTimeout(() => {
          reject(new Error('Logo upload timed out. Please try again.'));
        }, 60000); // 60 seconds

        task.on(
          'state_changed',
          (snapshot) => {
            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            this.progress.set(p);
          },
          (error) => {
            clearTimeout(timeout);
            console.error('[StorageService] Logo upload error:', error);
            reject(error);
          },
          async () => {
            clearTimeout(timeout);
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          }
        );
      });
    } finally {
      this.uploading.set(false);
      this.progress.set(0);
    }
  }

  async uploadImage(businessId: string, file: File): Promise<string> {
    const validation = this.validateFile(file);
    if (!validation.valid) throw new Error(validation.error);

    this.uploading.set(true);
    this.progress.set(0);

    try {
      const storage = this.getStorageInstance();
      const filename = `${Date.now()}-${file.name}`;
      const path = `businesses/${businessId}/images/${filename}`;
      const storageRef = ref(storage, path);
      const task: UploadTask = uploadBytesResumable(storageRef, file);

      return new Promise<string>((resolve, reject) => {
        // Set a timeout so the upload never hangs forever
        const timeout = setTimeout(() => {
          reject(new Error('Image upload timed out. Please try again.'));
        }, 60000); // 60 seconds

        task.on(
          'state_changed',
          (snapshot) => {
            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            this.progress.set(p);
          },
          (error) => {
            clearTimeout(timeout);
            console.error('[StorageService] Image upload error:', error);
            reject(error);
          },
          async () => {
            clearTimeout(timeout);
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          }
        );
      });
    } finally {
      this.uploading.set(false);
      this.progress.set(0);
    }
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const storage = this.getStorageInstance();
      const storageRef = ref(storage, url);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn('[StorageService] File deletion failed (may not exist):', err);
    }
  }
}
