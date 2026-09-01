import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Business } from '../../../models/business.model';

@Component({
  selector: 'app-salon01',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './salon01.component.html',
  styleUrl: './salon01.component.css',
})
export class Salon01Component {
  @Input({ required: true }) business!: Business;
  currentYear = new Date().getFullYear();

  get heroImage(): string {
    return this.business.images?.[0] || '';
  }

  get galleryImages(): string[] {
    return this.business.images || [];
  }

  get whatsappUrl(): string {
    const phone = this.business.whatsapp?.replace(/[^0-9]/g, '') || '';
    return `https://wa.me/${phone}`;
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
