/**
 * Shared authorization for callable Cloud Functions.
 *
 * The application's authorization model is an email allowlist (see
 * src/app/services/auth.service.ts on the client). Every callable function
 * that touches custom domains or publishing must go through this check so
 * the allowlist stays in a single place.
 */
export declare const ALLOWED_EMAILS: string[];
export type CallableRequest<T> = {
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
 * Validates that the caller is authenticated AND on the allowlist.
 * Throws an HttpsError otherwise.
 */
export declare function checkAuthorization(auth: CallableRequest<any>['auth']): Promise<{
    uid: string;
    email: string;
}>;
//# sourceMappingURL=auth.d.ts.map