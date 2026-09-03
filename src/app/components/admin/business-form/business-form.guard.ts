import type { CanDeactivateFn } from '@angular/router';
import type { BusinessFormComponent } from './business-form.component';

/**
 * Prompts before leaving the business form / builder while it holds
 * unsaved changes. The component exposes canDeactivate() for this guard.
 */
export const businessFormGuard: CanDeactivateFn<BusinessFormComponent> = (
  component
) => {
  return component.canDeactivate();
};
