/**
 * Domain utilities for custom domain management.
 * Includes normalization, validation, and secure verification token generation.
 */
import { Timestamp } from 'firebase/firestore';

/**
 * Normalize a domain input to a clean hostname.
 * - Removes protocol (http://, https://)
 * - Removes trailing slash
 * - Removes surrounding whitespace
 * - Lowercases the result
 * - Preserves meaningful subdomains
 * - Rejects paths, query strings, fragments, and non-http(s) protocols
 */
export function normalizeDomain(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  let domain = input.trim();

  if (!domain) return null;

  // Reject javascript: and data: URLs
  if (/^(javascript|data):/i.test(domain)) return null;

  try {
    // If it looks like a URL with protocol, parse it
    if (domain.includes('://')) {
      const url = new URL(domain);
      // Only allow http/https protocols
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      // Reject paths, query strings, fragments
      if (url.pathname !== '/' && url.pathname !== '') return null;
      if (url.search) return null;
      if (url.hash) return null;
      domain = url.hostname;
    } else {
      // No protocol - treat as hostname, but validate it doesn't contain path/query/fragment
      if (domain.includes('/') || domain.includes('?') || domain.includes('#')) return null;
    }
  } catch {
    // Invalid URL format
    return null;
  }

  // Remove trailing dot (valid in DNS but we normalize)
  domain = domain.replace(/\.$/, '');

  // Lowercase
  domain = domain.toLowerCase();

  // Basic hostname validation - must have at least one dot for a valid domain
  // (but allow localhost for development if needed)
  if (!domain) return null;

  return domain;
}

/**
 * Validate a normalized domain hostname.
 * Returns true for syntactically valid hostnames that could be custom domains.
 * Does NOT verify ownership - that's a separate DNS verification step.
 */
export function isValidDomainHostname(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;

  // Reject empty
  if (domain.trim() === '') return false;

  // Reject localhost and local addresses
  if (domain === 'localhost') return false;
  if (domain === '127.0.0.1') return false;
  if (domain === '::1') return false;
  if (domain.endsWith('.localhost')) return false;
  if (domain.endsWith('.local')) return false;
  if (domain.endsWith('.internal')) return false;
  if (domain.match(/^10\./)) return false; // Private IP ranges
  if (domain.match(/^192\.168\./)) return false;
  if (domain.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return false;

  // Hostname validation per RFC 1123/RFC 952
  // Each label: 1-63 chars, alphanumeric + hyphen (not start/end with hyphen)
  // Total length: max 253 chars
  if (domain.length > 253) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false; // Must have at least one dot (TLD)

  for (const label of labels) {
    if (label.length === 0 || label.length > 63) return false;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label)) return false;
  }

  // TLD should not be all numeric
  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) return false;

  return true;
}

/**
 * Generate a cryptographically secure verification token.
 * Uses crypto.randomUUID() when available (modern browsers/Node),
 * falls back to crypto.getRandomValues() for older environments.
 * The token is NOT derived from business name, domain, or timestamp alone.
 */
export function generateVerificationToken(): string {
  // Use crypto.randomUUID() if available (cryptographically secure)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    // Generate two UUIDs and combine for extra entropy
    return `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
  }

  // Fallback: use crypto.getRandomValues for secure random bytes
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(32); // 256 bits
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

    // Last resort: Math.random with timestamp (NOT cryptographically secure)
  // This should only happen in very old environments
  console.warn('[domain-utils] Using insecure fallback for verification token generation');
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 18);
  const randomPart2 = Math.random().toString(36).substring(2, 18);
  return `${timestamp}${randomPart}${randomPart2}`;
}

/**
 * Create a custom domain configuration with pending status and verification token.
 */
export function createCustomDomainConfig(domain: string): {
  domain: string;
  status: 'pending';
  verificationToken: string;
} {
  const normalized = normalizeDomain(domain);
  if (!normalized || !isValidDomainHostname(normalized)) {
    throw new Error('Invalid domain format');
  }

  return {
    domain: normalized,
    status: 'pending',
    verificationToken: generateVerificationToken(),
  };
}

/**
 * Get the TXT record name for domain verification.
 * This is the subdomain where the verification token should be placed.
 */
export const VERIFICATION_TXT_HOST = '_demosite-verification';

/**
 * Get the full TXT record value for verification.
 * Format: "demosite-verification=<token>"
 */
export function getVerificationTxtValue(token: string): string {
  return `demosite-verification=${token}`;
}

/**
 * Check if a custom domain config is verified and active.
 */
export function isCustomDomainActive(config: { status?: string } | undefined): boolean {
  return config?.status === 'verified';
}

/**
 * Get the canonical public URL for a business.
 * Uses custom domain if verified, otherwise falls back to platform demo URL.
 */
export function getCanonicalUrl(
  business: { slug: string; customDomain?: { domain: string; status: string } },
  platformOrigin: string
): string {
  if (isCustomDomainActive(business.customDomain)) {
    const protocol = platformOrigin.startsWith('https://') ? 'https://' : 'http://';
    return `${protocol}${business.customDomain!.domain}`;
  }
  return `${platformOrigin}/demo/${business.slug}`;
}