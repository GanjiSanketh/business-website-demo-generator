import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnInit {
  sidebarOpen = signal(false);
  wideLayout = signal(false);
  profileMenuOpen = signal(false);

  private userService = inject(UserService);

  profile = computed(() => this.userService.profile());
  displayName = computed(() => this.profile()?.displayName || 'User');
  email = computed(() => this.profile()?.email || '');
  photoURL = computed(() => this.profile()?.photoURL);
  isAdmin = computed(() => this.userService.isAdmin());
  planName = computed(() => {
    const plan = this.profile()?.plan;
    return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Free';
  });
  initials = computed(() => {
    const name = this.displayName();
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  });

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.wideLayout.set(
          /^\/admin\/business\/[^/]+\/edit$/.test(event.urlAfterRedirects)
        );
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) {
      this.profileMenuOpen.set(false);
    }
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.set(!this.profileMenuOpen());
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  async logout(): Promise<void> {
    this.profileMenuOpen.set(false);
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
