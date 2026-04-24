import { initializeApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// User-provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBgLVBYYOh5AnFvad9ge1Z7TPnoVDTKLoM",
  authDomain: "tobotalk-68541.firebaseapp.com",
  projectId: "tobotalk-68541",
  storageBucket: "tobotalk-68541.firebasestorage.app",
  messagingSenderId: "642130159508",
  appId: "1:642130159508:web:6e9d473ecbd47e46069181",
  measurementId: "G-GK6SKJVFNL"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Enable persistence for offline access and lower DB costs (serves from cache when possible)
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence failed: Browser not supported');
    }
});

// Safe analytics initialization (Commented out to prevent generic Script errors in restricted iframes)
/*
isSupported().then(supported => {
  if (supported) {
    getAnalytics(app);
  }
}).catch(err => console.warn('Analytics not supported:', err));
*/
