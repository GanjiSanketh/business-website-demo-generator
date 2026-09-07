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
exports.ALLOWED_EMAILS = void 0;
exports.checkAuthorization = checkAuthorization;
const functions = __importStar(require("firebase-functions/v2"));
/**
 * Shared authorization for callable Cloud Functions.
 *
 * The application's authorization model is an email allowlist (see
 * src/app/services/auth.service.ts on the client). Every callable function
 * that touches custom domains or publishing must go through this check so
 * the allowlist stays in a single place.
 */
exports.ALLOWED_EMAILS = ['gsanketh7121@gmail.com'];
/**
 * Validates that the caller is authenticated AND on the allowlist.
 * Throws an HttpsError otherwise.
 */
async function checkAuthorization(auth) {
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const email = auth.token.email;
    if (!email || !exports.ALLOWED_EMAILS.includes(email)) {
        throw new functions.https.HttpsError('permission-denied', 'You are not authorized to perform this action');
    }
    return { uid: auth.uid, email };
}
//# sourceMappingURL=auth.js.map