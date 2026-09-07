import * as functions from 'firebase-functions/v2';

/**
 * Shared authorization for callable Cloud Functions.
 *
 * The application's authorization model is an email allowlist (see
 * src/app/services/auth.service.ts on the client). Every callable function
 * that touches custom domains or publishing must go through this check so
 * the allowlist stays in a single place.
 */
export const ALLOWED_EMAILS = ['gsanketh7121@gmail.com'];

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
export async function checkAuthorization(
  auth: CallableRequest<any>['auth']
): Promise<{ uid: string; email: string }> {
  if (!auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  const email = auth.token.email;
  if (!email || !ALLOWED_EMAILS.includes(email)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You are not authorized to perform this action'
    );
  }

  return { uid: auth.uid, email };
}