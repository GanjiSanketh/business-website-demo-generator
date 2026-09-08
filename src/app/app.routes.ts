import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';
import { businessOwnershipGuard } from './guards/business-ownership.guard';
import { hostDemoGuard } from './guards/host-demo.guard';
import { LoginComponent } from './components/login/login.component';
import { AdminLayoutComponent } from './components/admin/layout/admin-layout.component';
import { DashboardComponent } from './components/admin/dashboard/dashboard.component';
import { BusinessFormComponent } from './components/admin/business-form/business-form.component';
import { BillingComponent } from './components/admin/billing/billing.component';
import { businessFormGuard } from './components/admin/business-form/business-form.guard';
import { DemoPageComponent } from './components/demo/demo-page/demo-page.component';

export const routes: Routes = [
  {
    path: '',
    component: DemoPageComponent,
    pathMatch: 'full',
    canActivate: [hostDemoGuard],
  },
  { path: '', redirectTo: '/admin', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardComponent },
      { path: 'businesses', redirectTo: '', pathMatch: 'full' },
      {
        path: 'business/new',
        component: BusinessFormComponent,
        canDeactivate: [businessFormGuard],
      },
      {
        path: 'business/:id/edit',
        component: BusinessFormComponent,
        canDeactivate: [businessFormGuard],
        canActivate: [businessOwnershipGuard],
      },
      {
        path: 'billing',
        component: BillingComponent,
      },
    ],
  },
  { path: 'demo/:slug', component: DemoPageComponent },
  { path: '**', redirectTo: '/admin' },
];