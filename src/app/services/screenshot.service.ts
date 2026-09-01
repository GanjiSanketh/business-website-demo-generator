import { Injectable, inject, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import { toPng } from 'html-to-image';
import { Business } from '../models/business.model';
import { Salon01Component } from '../components/demo/salon01/salon01.component';
import { CommonModule } from '@angular/common';

export type ScreenshotFormat = 'desktop' | 'mobile';

const VIEWPORTS: Record<ScreenshotFormat, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

@Injectable({ providedIn: 'root' })
export class ScreenshotService {
  private appRef = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);

  /**
   * Pre-fetch all Firebase Storage images as data URLs to avoid CORS issues
   * during canvas capture. Returns a map of original URL → data URL.
   */
  private async prefetchImages(urls: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const uniqueUrls = [...new Set(urls.filter((u) => u && u.startsWith('http')))];

    await Promise.all(
      uniqueUrls.map(async (url) => {
        try {
          const response = await fetch(url, { mode: 'cors' });
          const blob = await response.blob();
          const dataUrl = await this.blobToDataUrl(blob);
          map.set(url, dataUrl);
        } catch {
          console.warn('[Screenshot] Could not prefetch image:', url);
        }
      })
    );

    return map;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Replace all img src attributes in a container with prefetched data URLs.
   * Returns a cleanup function that restores original srcs.
   */
  private replaceImageSources(
    container: HTMLElement,
    imageMap: Map<string, string>
  ): () => void {
    const imgs = container.querySelectorAll<HTMLImageElement>('img');
    const originals: { img: HTMLImageElement; src: string }[] = [];

    imgs.forEach((img) => {
      const originalSrc = img.getAttribute('src') || img.src;
      if (imageMap.has(originalSrc)) {
        originals.push({ img, src: originalSrc });
        img.src = imageMap.get(originalSrc)!;
      }
    });

    // Also handle background-image styles
    const bgElements = container.querySelectorAll<HTMLElement>(
      '[style*="backgroundImage"], [style*="background-image"]'
    );
    const bgOriginals: { el: HTMLElement; style: string }[] = [];

    bgElements.forEach((el) => {
      const originalStyle = el.getAttribute('style') || '';
      for (const [url, dataUrl] of imageMap) {
        if (originalStyle.includes(url)) {
          bgOriginals.push({ el, style: originalStyle });
          el.style.backgroundImage = `url(${dataUrl})`;
          break;
        }
      }
    });

    return () => {
      originals.forEach(({ img, src }) => {
        img.src = src;
      });
      bgOriginals.forEach(({ el, style }) => {
        el.setAttribute('style', style);
      });
    };
  }

  /**
   * Generate a full-page PNG screenshot of a DOM element.
   */
  private async captureElement(
    element: HTMLElement,
    format: ScreenshotFormat
  ): Promise<string> {
    const viewport = VIEWPORTS[format];

    // Collect all image URLs from the business for pre-fetching
    const allImageUrls = this.collectImageUrls(element);
    const imageMap = await this.prefetchImages(allImageUrls);

    // Replace image sources with data URLs
    const cleanup = this.replaceImageSources(element, imageMap);

    try {
      // Wait for images to settle
      await new Promise((r) => setTimeout(r, 500));

      const dataUrl = await toPng(element, {
        width: viewport.width,
        pixelRatio: 2, // High-resolution output
        backgroundColor: '#ffffff',
        style: {
          overflow: 'visible',
          height: 'auto',
        },
      });

      return dataUrl;
    } finally {
      cleanup();
    }
  }

  private collectImageUrls(container: HTMLElement): string[] {
    const urls: string[] = [];

    // Collect img src attributes
    container.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const src = img.getAttribute('src') || img.src;
      if (src && src.startsWith('http')) {
        urls.push(src);
      }
    });

    // Collect background-image URLs
    container
      .querySelectorAll<HTMLElement>('[style*="backgroundImage"], [style*="background-image"]')
      .forEach((el) => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
        if (match) {
          urls.push(match[1]);
        }
      });

    return urls;
  }

  /**
   * Create a hidden container, render the salon template into it,
   * capture it, then clean up.
   */
  async generateScreenshot(
    business: Business,
    format: ScreenshotFormat
  ): Promise<string> {
    const viewport = VIEWPORTS[format];

    // Create a hidden container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: ${viewport.width}px;
      overflow: visible;
      background: white;
      z-index: -1;
      pointer-events: none;
    `;
    document.body.appendChild(container);

    let componentRef: any = null;

    try {
      // Dynamically create the salon component within the existing app
      componentRef = createComponent(Salon01Component, {
        environmentInjector: this.injector,
        hostElement: container,
      });
      componentRef.instance.business = business;
      componentRef.changeDetectorRef.detectChanges();

      // Wait for Angular to render
      await new Promise((r) => setTimeout(r, 1000));

      // Wait for images to load
      await this.waitForImages(container);

      // Capture
      const dataUrl = await this.captureElement(container, format);

      return dataUrl;
    } catch (error) {
      console.error('[Screenshot] Generation failed:', error);
      throw error;
    } finally {
      if (componentRef) {
        componentRef.destroy();
      }
      document.body.removeChild(container);
    }
  }

  private async waitForImages(container: HTMLElement): Promise<void> {
    const images = container.querySelectorAll<HTMLImageElement>('img');
    const loadPromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Don't block on failed images
        // Timeout after 5 seconds
        setTimeout(() => resolve(), 5000);
      });
    });
    await Promise.all(loadPromises);
  }

  /**
   * Download a data URL as a PNG file.
   */
  downloadScreenshot(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  getFilename(business: Business, format: ScreenshotFormat): string {
    const slug = business.slug || 'business';
    return `${slug}-${format}.png`;
  }
}
