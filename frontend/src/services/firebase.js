
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDecZLYqIxAMbqDQc7Vp66pCGoUtIQHxi4",
  authDomain: "psico-suporte-ufc.firebaseapp.com",
  projectId: "psico-suporte-ufc",
  storageBucket: "psico-suporte-ufc.firebasestorage.app",
  messagingSenderId: "863629654317",
  appId: "1:863629654317:web:e374c811b92266f3c13ba4",
  measurementId: "G-P079YB4MMB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);