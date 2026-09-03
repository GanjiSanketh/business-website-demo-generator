import { Type } from '@angular/core';
import { Business } from '../../../models/business.model';

export interface TemplateMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
  supported: boolean;
  component: Type<unknown>;
}

export const TEMPLATE_REGISTRY: Record<string, TemplateMetadata> = {
  'salon-01': {
    id: 'salon-01',
    name: 'Salon 01',
    category: 'Salon',
    description: 'Elegant modern salon website',
    supported: true,
    component: null as unknown as Type<unknown>,
  },
  'salon-02': {
    id: 'salon-02',
    name: 'Salon 02',
    category: 'Salon',
    description: 'Boutique luxe dark salon website',
    supported: true,
    component: null as unknown as Type<unknown>,
  },
};

export function registerTemplateComponent(id: string, component: Type<unknown>): void {
  if (TEMPLATE_REGISTRY[id]) {
    TEMPLATE_REGISTRY[id].component = component;
  }
}

export function getTemplateMetadata(templateId: string): TemplateMetadata | undefined {
  return TEMPLATE_REGISTRY[templateId];
}

export function getTemplateComponent(templateId: string): Type<unknown> | null {
  const metadata = TEMPLATE_REGISTRY[templateId];
  return metadata?.component ?? null;
}

export function getSupportedTemplates(): TemplateMetadata[] {
  return Object.values(TEMPLATE_REGISTRY).filter((t) => t.supported);
}

export function getTemplatesForCategory(category: string): TemplateMetadata[] {
  return Object.values(TEMPLATE_REGISTRY).filter(
    (t) => t.category.toLowerCase() === category.toLowerCase() && t.supported
  );
}

export function getDefaultTemplateForCategory(category: string): string | null {
  const templates = getTemplatesForCategory(category);
  return templates.length > 0 ? templates[0].id : null;
}

export function isTemplateSupported(templateId: string): boolean {
  const metadata = TEMPLATE_REGISTRY[templateId];
  return metadata?.supported ?? false;
}

export function getTemplateDisplayName(templateId: string): string {
  const metadata = TEMPLATE_REGISTRY[templateId];
  return metadata?.name ?? templateId;
}

export function getTemplateCategory(templateId: string): string {
  const metadata = TEMPLATE_REGISTRY[templateId];
  return metadata?.category ?? 'Unknown';
}