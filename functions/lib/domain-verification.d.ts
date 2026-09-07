export interface VerifyCustomDomainRequest {
    businessId: string;
    domain: string;
}
export interface VerifyCustomDomainResponse {
    success: boolean;
    status?: 'verified' | 'pending' | 'disabled';
    error?: string;
    errorCode?: string;
}
type CallableRequest<T> = {
    data: T;
    auth?: {
        uid: string;
        token: {
            email?: string;
            [key: string]: any;
        };
    };
    app?: any;
    instanceIdToken?: string;
    rawRequest: any;
    acceptsStreaming: boolean;
};
/**
 * Main callable function handler for custom domain verification.
 * Uses v2 CallableRequest format: handler(request) where request.data has the typed payload.
 */
export declare function verifyCustomDomain(request: CallableRequest<VerifyCustomDomainRequest>): Promise<VerifyCustomDomainResponse>;
export {};
//# sourceMappingURL=domain-verification.d.ts.map