import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

/**
 * Keep the room cache and the pending-write queue in IndexedDB rather than in
 * memory. Maintenance works the floors, so a status tapped in a weak-signal
 * corridor has to survive the app being closed before it reaches the server,
 * and the board has to open with the last known state instead of nothing.
 *
 * IndexedDB is refused in some private-browsing modes; fall back to the
 * in-memory cache there rather than failing to start.
 */
function createDb(instance: FirebaseApp): Firestore {
  try {
    return initializeFirestore(instance, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn('Offline persistence unavailable; using an in-memory cache.', err);
    return getFirestore(instance);
  }
}

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = createDb(app);
  auth = getAuth(app);
}

export { app, db, auth };

/** Shared so every caller waits on one sign-in rather than starting its own. */
let signIn: Promise<void> | null = null;

/**
 * Resolves once there is a user the Firestore rules will accept.
 *
 * Reading `auth.currentUser` directly is not enough: on a cold start Firebase
 * restores a persisted session asynchronously, so it is briefly null even for
 * a device that has been signed in for months. Acting on that would sign in a
 * second anonymous user and orphan the first. `onAuthStateChanged` fires once
 * the restore has settled, which is the first honest answer available.
 */
export function ensureSignedIn(): Promise<void> {
  if (!auth) return Promise.resolve();
  if (!signIn) {
    const instance = auth;
    signIn = new Promise<void>((resolve, reject) => {
      const stop = onAuthStateChanged(
        instance,
        (user) => {
          stop();
          if (user) resolve();
          else signInAnonymously(instance).then(() => resolve(), reject);
        },
        reject,
      );
    });
    // A failed sign-in has to be retryable, so don't leave the rejection cached.
    signIn.catch(() => {
      signIn = null;
    });
  }
  return signIn;
}
