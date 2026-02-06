// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBoy1Z2C5To6WKxhqZvd9u_cS_naTEMkKQ",
  authDomain: "ghibaplus.firebaseapp.com",
  projectId: "ghibaplus",
  storageBucket: "ghibaplus.firebasestorage.app",
  messagingSenderId: "50224474807",
  appId: "1:50224474807:web:abdc627dc83cec09cabb32"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);