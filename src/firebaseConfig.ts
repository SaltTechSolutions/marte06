// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Auth servisi için eklendi
import { initializeFirestore, persistentLocalCache } from "firebase/firestore"; // Firestore servisi için eklendi
import { getStorage } from "firebase/storage"; // Storage servisi için eklendi
import type { Analytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app); // Auth servisi başlatıldı
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
}); // Firestore servisi başlatıldı, offline persistence aktif

let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  import('firebase/analytics').then(({ getAnalytics }) => {
    analytics = getAnalytics(app);
  });
}

const storage = getStorage(app); // Storage servisi başlatıldı

export { auth, db, analytics, storage }; // auth, db, analytics ve storage dışa aktarıldı