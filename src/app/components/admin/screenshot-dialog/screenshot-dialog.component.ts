import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScreenshotService, ScreenshotFormat } from '../../../services/screenshot.service';
import { Business } from '../../../models/business.model';

@Component({
  selector: 'app-screenshot-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './screenshot-dialog.component.html',
  styleUrl: './screenshot-dialog.component.css',
})
export class ScreenshotDialogComponent {
  @Input({ required: true }) business!: Business;
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  step = signal<'choose' | 'generating' | 'preview' | 'error'>('choose');
  previewUrl = signal<string>('');
  currentFormat = signal<ScreenshotFormat | null>(null);
  statusMessage = signal('');
  errorMessage = signal('');

  constructor(private screenshotService: ScreenshotService) {}

  close(): void {
    this.step.set('choose');
    this.previewUrl.set('');
    this.currentFormat.set(null);
    this.errorMessage.set('');
    this.closed.emit();
  }

  async generateScreenshot(format: ScreenshotFormat): Promise<void> {
    this.currentFormat.set(format);
    this.step.set('generating');

    const messages = [
      'Preparing website...',
      'Loading images...',
      'Rendering screenshot...',
      'Generating image...',
    ];

    let msgIndex = 0;
    this.statusMessage.set(messages[0]);
    const interval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, messages.length - 1);
      this.statusMessage.set(messages[msgIndex]);
    }, 2000);

    try {
      const dataUrl = await this.screenshotService.generateScreenshot(
        this.business,
        format
      );
      clearInterval(interval);
      this.previewUrl.set(dataUrl);
      this.step.set('preview');
    } catch (error) {
      clearInterval(interval);
      console.error('[Screenshot] Error:', error);
      this.errorMessage.set(
        'Unable to generate the screenshot. Please try again.'
      );
      this.step.set('error');
    }
  }

  download(): void {
    if (!this.previewUrl() || !this.currentFormat()) return;
    const filename = this.screenshotService.getFilename(
      this.business,
      this.currentFormat()!
    );
    this.screenshotService.downloadScreenshot(this.previewUrl(), filename);
  }

  generateAgain(): void {
    this.step.set('choose');
    this.previewUrl.set('');
    this.currentFormat.set(null);
  }
}
