/**
 * Server-side enforcement callables for business CRUD operations.
 *
 * These Cloud Functions enforce plan limits atomically before writing to Firestore.
 * The client cannot bypass these checks because they run server-side with Admin SDK.
 *
 * Flow:
 * 1. Client sends business data to callable function
 * 2. Function verifies authentication
 * 3. Function loads user profile to get plan/subscription
 * 4. Function enforces plan limits (business count, published count, custom domains)
 * 5. If allowed, function writes to Firestore and returns document ID
 * 6. If denied, function throws HttpsError with reason
 */
import { CallableRequest } from './auth';
export interface BusinessCreateRequest {
    businessName: string;
    category?: string;
    templateId?: string;
    tagline?: string;
    description?: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    services?: string[];
    slug?: string;
    status?: 'draft' | 'published';
    logoUrl?: string;
    images?: string[];
    themeId?: string;
    themeOptions?: Record<string, any>;
    testimonials?: any[];
    faqs?: any[];
    socialLinks?: Record<string, string>;
    primaryCta?: any;
    announcement?: any;
    businessHours?: any;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string;
    socialImageUrl?: string;
    faviconUrl?: string;
}
export interface BusinessCreateResponse {
    id?: string;
    error?: string;
}
export interface BusinessPublishRequest {
    businessId: string;
}
export interface BusinessPublishResponse {
    success?: boolean;
    error?: string;
}
export interface CustomDomainRequest {
    businessId: string;
    domain: string;
}
export interface CustomDomainResponse {
    domain?: string;
    status?: string;
    verificationToken?: string;
    error?: string;
}
/**
 * Server-authoritative business creation.
 *
 * Uses a Firestore transaction to atomically count existing businesses
 * and create the new one, preventing race conditions.
 */
export declare function createBusinessFn(request: CallableRequest<BusinessCreateRequest>): Promise<BusinessCreateResponse>;
/**
 * Server-authoritative business publishing.
 *
 * Uses a Firestore transaction to atomically count published businesses
 * and publish the target, preventing race conditions.
 */
export declare function publishBusinessFn(request: CallableRequest<BusinessPublishRequest>): Promise<BusinessPublishResponse>;
/**
 * Server-authoritative custom domain connection.
 *
 * Uses a Firestore transaction to atomically check domain limits,
 * uniqueness, and connect the domain.
 */
export declare function connectCustomDomainFn(request: CallableRequest<CustomDomainRequest>): Promise<CustomDomainResponse>;
//# sourceMappingURL=enforcement-callables.d.ts.map