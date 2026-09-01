import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { LoginComponent } from './components/login/login.component';
import { AdminLayoutComponent } from './components/admin/layout/admin-layout.component';
import { DashboardComponent } from './components/admin/dashboard/dashboard.component';
import { BusinessFormComponent } from './components/admin/business-form/business-form.component';
import { DemoPageComponent } from './components/demo/demo-page/demo-page.component';

export const routes: Routes = [
  { path: '', redirectTo: '/admin', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardComponent },
      { path: 'businesses', redirectTo: '', pathMatch: 'full' },
      { path: 'business/new', component: BusinessFormComponent },
      { path: 'business/:id/edit', component: BusinessFormComponent },
    ],
  },
  { path: 'demo/:slug', component: DemoPageComponent },
  { path: '**', redirectTo: '/admin' },
];
