import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

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
export async function requireAuth(
  auth: CallableRequest<any>['auth']
): Promise<{ uid: string; email?: string }> {
  if (!auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  return { uid: auth.uid, email: auth.token.email };
}

/**
 * Validates that the caller is authenticated AND has admin role.
 * Uses Admin SDK to fetch user profile from Firestore.
 * Throws an HttpsError otherwise.
 */
export async function requireAdmin(
  auth: CallableRequest<any>['auth']
): Promise<{ uid: string; email?: string }> {
  const { uid } = await requireAuth(auth);

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User profile not found'
    );
  }

  const userData = userDoc.data();
  if (userData?.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Admin access required'
    );
  }

  return { uid, email: userData?.email };
}

/**
 * Validates that the caller owns the specified business.
 * Throws an HttpsError if not owner or admin.
 */
export async function requireBusinessOwner(
  auth: CallableRequest<any>['auth'],
  businessId: string
): Promise<{ uid: string; email?: string }> {
  const { uid } = await requireAuth(auth);

  const db = admin.firestore();
  const businessDoc = await db.collection('businesses').doc(businessId).get();

  if (!businessDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'Business not found'
    );
  }

  const businessData = businessDoc.data()!;

  // Admin can access any business
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists && userDoc.data()?.role === 'admin') {
    return { uid, email: userDoc.data()?.email };
  }

  // Check ownership
  if (businessData.ownerId !== uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not own this business'
    );
  }

  return { uid, email: auth?.token?.email };
}