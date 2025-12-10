// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);