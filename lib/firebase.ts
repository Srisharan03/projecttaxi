import { getApp, getApps, initializeApp } from "firebase/app";
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

function normalizeStorageBucket(bucket?: string): string | undefined {
  if (!bucket) {
    return bucket;
  }

  if (bucket.endsWith(".firebasestorage.app")) {
    const normalized = bucket.replace(/\.firebasestorage\.app$/, ".appspot.com");
    console.warn(
      `[Firebase] Normalized storage bucket from ${bucket} to ${normalized}. ` +
        "Use .appspot.com in NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.",
    );
    return normalized;
  }

  return bucket;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: normalizeStorageBucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

if (!hasFirebaseConfig) {
  console.warn(
    "[Firebase] Missing one or more NEXT_PUBLIC_FIREBASE_* environment variables. " +
      "Using placeholders until real values are configured.",
  );
}

const fallbackConfig = {
  apiKey: firebaseConfig.apiKey ?? "demo-api-key",
  authDomain: firebaseConfig.authDomain ?? "demo.firebaseapp.com",
  projectId: firebaseConfig.projectId ?? "demo-project",
  storageBucket: firebaseConfig.storageBucket ?? "demo.appspot.com",
  messagingSenderId: firebaseConfig.messagingSenderId ?? "0000000000",
  appId: firebaseConfig.appId ?? "1:0000000000:web:demo",
};

const app = getApps().length ? getApp() : initializeApp(fallbackConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export function subscribeToCollection<T>(
  collectionName: string,
  onChange: (data: Array<T & { id: string }>) => void,
  options?: {
    constraints?: QueryConstraint[];
    onError?: (error: Error) => void;
  },
): Unsubscribe {
  const ref = collection(db, collectionName);
  const q = options?.constraints?.length ? query(ref, ...options.constraints) : query(ref);

  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as T),
      }));
      onChange(data);
    },
    (error) => {
      console.error(`[Firebase] Real-time listener failed for ${collectionName}:`, error);
      options?.onError?.(error as Error);
    },
  );
}
