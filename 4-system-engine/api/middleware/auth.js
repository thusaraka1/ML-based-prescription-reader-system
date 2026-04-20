// Firebase Admin SDK middleware for token verification
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccountPath = resolve(__dirname, '../../serviceAccountKey.json');

if (existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  console.log('✅ Firebase Admin SDK initialized');
} else {
  console.warn('⚠️  serviceAccountKey.json not found at:', serviceAccountPath);
  console.warn('   Auth middleware will run in permissive mode (no token verification).');
  if (!admin.apps.length) {
    // Initialize without credentials for development
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'pescription',
    });
  }
}

/**
 * Express middleware: Verify Firebase ID token from Authorization header.
 * Sets req.user = { uid, email, role } on success.
 *
 * In development (no service account), it falls through permissively.
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Allow unauthenticated requests in development
    if (process.env.NODE_ENV !== 'production') {
      req.user = { uid: 'dev-user', email: 'dev@local', role: 'admin' };
      return next();
    }
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: decodedToken.role || 'patient', // Custom claim or default
    };
    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error.message);

    // In development, fall through
    if (process.env.NODE_ENV !== 'production') {
      req.user = { uid: 'dev-user', email: 'dev@local', role: 'admin' };
      return next();
    }

    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export default admin;
