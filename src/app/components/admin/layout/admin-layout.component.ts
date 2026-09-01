import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  sidebarOpen = signal(false);

  constructor(private authService: AuthService, private router: Router) {}

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
