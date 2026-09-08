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
export declare function verifyCustomDomain(request: CallableRequest<VerifyCustomDomainRequest>): Promise<VerifyCustomDomainResponse>;
//# sourceMappingURL=domain-verification.d.ts.map