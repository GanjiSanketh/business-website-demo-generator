import { CallableRequest } from './auth';
export interface VerifyCustomDomainRequest {
    businessId: string;
    domain: string;
}
export interface VerifyCustomDomainResponse {
    success: boolean;
    status?: 'verified' | 'pending' | 'disabled' | 'live';
    error?: string;
    errorCode?: string;
}
/**
 * Main callable function handler for custom domain verification.
 * Uses v2 CallableRequest format: handler(request) where request.data has the typed payload.
 */
export declare function verifyCustomDomain(request: CallableRequest<VerifyCustomDomainRequest>): Promise<VerifyCustomDomainResponse>;
//# sourceMappingURL=domain-verification.d.ts.map