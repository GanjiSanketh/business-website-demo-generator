import { Injectable, inject, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import { toPng } from 'html-to-image';
import { Business } from '../models/business.model';
import { CommonModule } from '@angular/common';
import {
  getDefaultThemeForTemplate,
  getTemplateComponent,
} from '../components/demo/templates/template.registry';
import { resolveThemeConfig } from '../components/demo/themes/theme.registry';

import '../components/demo/templates/template.init';

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

    // The templates use `position: fixed` for their sticky header and mobile
    // CTA bar, which is correct on the real /demo/:slug page (the capture
    // container IS the viewport there). Here the container is an offscreen
    // <div>, not a real viewport — `fixed` positions relative to the actual
    // browser viewport instead, so the header/CTA visually escape the
    // container entirely and html-to-image never captures them where they
    // should appear. Pin them to `absolute` within the container (which is
    // itself `position: fixed`, so it still establishes a containing block)
    // for the duration of the capture, then restore the original styling.
    const restorePositioning = this.neutralizeFixedPositioning(element);

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
      restorePositioning();
      cleanup();
    }
  }

  private neutralizeFixedPositioning(container: HTMLElement): () => void {
    const originals: { el: HTMLElement; style: string }[] = [];

    container.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const position = window.getComputedStyle(el).position;
      if (position === 'fixed' || position === 'sticky') {
        originals.push({ el, style: el.getAttribute('style') || '' });
        el.style.position = 'absolute';
      }
    });

    return () => {
      originals.forEach(({ el, style }) => {
        if (style) {
          el.setAttribute('style', style);
        } else {
          el.removeAttribute('style');
        }
      });
    };
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
      // Get the appropriate template component for this business
      const templateId = business.templateId || 'salon-01';
      const templateComponent = getTemplateComponent(templateId);

      if (!templateComponent) {
        throw new Error(`Unsupported template: ${templateId}`);
      }

      // Dynamically create the template component
      componentRef = createComponent(templateComponent, {
        environmentInjector: this.injector,
        hostElement: container,
      });
      componentRef.instance.business = business;
      componentRef.instance.theme = resolveThemeConfig(
        business.themeId,
        business.themeOptions,
        getDefaultThemeForTemplate(templateId)
      );
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
   * Render a template offscreen with the given business data and capture a
   * bounded top-region thumbnail (the hero/nav area that defines the design)
   * as a PNG data URL. Uses the exact same rendering pipeline as
   * generateScreenshot, so template galleries show each template's real
   * design instead of a placeholder. Explicit width/height make html-to-image
   * capture exactly that region (content below is clipped, not squashed).
   */
  async generateThumbnail(
    business: Business,
    width = 1440,
    height = 1000,
    pixelRatio = 1.5
  ): Promise<string> {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: white;
      z-index: -1;
      pointer-events: none;
    `;
    document.body.appendChild(container);

    let componentRef: any = null;

    try {
      const templateId = business.templateId || 'salon-01';
      const templateComponent = getTemplateComponent(templateId);

      if (!templateComponent) {
        throw new Error(`Unsupported template: ${templateId}`);
      }

      componentRef = createComponent(templateComponent, {
        environmentInjector: this.injector,
        hostElement: container,
      });
      componentRef.instance.business = business;
      componentRef.instance.theme = resolveThemeConfig(
        business.themeId,
        business.themeOptions,
        getDefaultThemeForTemplate(templateId)
      );
      componentRef.changeDetectorRef.detectChanges();

      // Let Angular paint before measuring/capturing.
      await new Promise((r) => setTimeout(r, 800));
      await this.waitForImages(container);

      // CORS-safe image capture + keep fixed headers inside the container.
      const imageMap = await this.prefetchImages(this.collectImageUrls(container));
      const cleanup = this.replaceImageSources(container, imageMap);
      const restorePositioning = this.neutralizeFixedPositioning(container);

      try {
        return await toPng(container, {
          width,
          height,
          pixelRatio,
          backgroundColor: '#ffffff',
        });
      } finally {
        restorePositioning();
        cleanup();
      }
    } catch (error) {
      console.error('[Screenshot] Thumbnail generation failed:', error);
      throw error;
    } finally {
      if (componentRef) {
        componentRef.destroy();
      }
      document.body.removeChild(container);
    }
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
