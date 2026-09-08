/**
 * Shared authorization for callable Cloud Functions.
 *
 * The application's authorization model uses Firestore user profiles.
 * Admin users have role == 'admin' in their user profile.
 */
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
 * Validates that the caller is authenticated.
 * Throws an HttpsError otherwise.
 */
export declare function requireAuth(auth: CallableRequest<any>['auth']): Promise<{
    uid: string;
    email?: string;
}>;
/**
 * Validates that the caller is authenticated AND has admin role.
 * Uses Admin SDK to fetch user profile from Firestore.
 * Throws an HttpsError otherwise.
 */
export declare function requireAdmin(auth: CallableRequest<any>['auth']): Promise<{
    uid: string;
    email?: string;
}>;
/**
 * Validates that the caller owns the specified business.
 * Throws an HttpsError if not owner or admin.
 */
export declare function requireBusinessOwner(auth: CallableRequest<any>['auth'], businessId: string): Promise<{
    uid: string;
    email?: string;
}>;
//# sourceMappingURL=auth.d.ts.map