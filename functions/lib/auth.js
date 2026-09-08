"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requireBusinessOwner = requireBusinessOwner;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
/**
 * Validates that the caller is authenticated.
 * Throws an HttpsError otherwise.
 */
async function requireAuth(auth) {
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    return { uid: auth.uid, email: auth.token.email };
}
/**
 * Validates that the caller is authenticated AND has admin role.
 * Uses Admin SDK to fetch user profile from Firestore.
 * Throws an HttpsError otherwise.
 */
async function requireAdmin(auth) {
    const { uid } = await requireAuth(auth);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'User profile not found');
    }
    const userData = userDoc.data();
    if (userData?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    return { uid, email: userData?.email };
}
/**
 * Validates that the caller owns the specified business.
 * Throws an HttpsError if not owner or admin.
 */
async function requireBusinessOwner(auth, businessId) {
    const { uid } = await requireAuth(auth);
    const db = admin.firestore();
    const businessDoc = await db.collection('businesses').doc(businessId).get();
    if (!businessDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Business not found');
    }
    const businessData = businessDoc.data();
    // Admin can access any business
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === 'admin') {
        return { uid, email: userDoc.data()?.email };
    }
    // Check ownership
    if (businessData.ownerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'You do not own this business');
    }
    return { uid, email: auth?.token?.email };
}
//# sourceMappingURL=auth.js.map