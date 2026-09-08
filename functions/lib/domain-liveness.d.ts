import { CallableRequest } from './auth';
export interface CheckCustomDomainLiveRequest {
    businessId: string;
}
export interface CheckCustomDomainLiveResponse {
    live: boolean;
    status?: 'verified' | 'live';
    message?: string;
}
export declare function checkCustomDomainLive(request: CallableRequest<CheckCustomDomainLiveRequest>): Promise<CheckCustomDomainLiveResponse>;
//# sourceMappingURL=domain-liveness.d.ts.map