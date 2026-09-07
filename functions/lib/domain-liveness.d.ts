import { CallableRequest } from './auth';
export interface CheckCustomDomainLiveRequest {
    businessId: string;
}
export interface CheckCustomDomainLiveResponse {
    live: boolean;
    status?: 'verified' | 'live';
    message?: string;
}
/**
 * Checks whether a verified custom domain is actually live — i.e. an HTTPS
 * request to https://<domain>/ successfully serves the published demo of the
 * owning business.
 *
 * This is the only way a domain transitions from 'verified' (ownership
 * proven via TXT) to 'live' (the application demonstrably answers on it).
 * The transition is NOT automatic: the operator must first add the domain to
 * Firebase Hosting (console/CLI) and point the domain's DNS at Firebase
 * Hosting. This function then confirms the result end-to-end.
 */
export declare function checkCustomDomainLive(request: CallableRequest<CheckCustomDomainLiveRequest>): Promise<CheckCustomDomainLiveResponse>;
//# sourceMappingURL=domain-liveness.d.ts.map