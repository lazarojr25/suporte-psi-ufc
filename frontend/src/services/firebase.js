
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDecZLYqIxAMbqDQc7Vp66pCGoUtIQHxi4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "psico-suporte-ufc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "psico-suporte-ufc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "psico-suporte-ufc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "863629654317",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:863629654317:web:e374c811b92266f3c13ba4",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-P079YB4MMB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
