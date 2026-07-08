import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "infinite-courage-3n56p",
  appId: "1:308344252083:web:f40cee03866ca4653372c6",
  apiKey: "AIzaSyDZmmEHWoVyukMU_Iki8A4G9akiw3bEz_4",
  authDomain: "infinite-courage-3n56p.firebaseapp.com",
  storageBucket: "infinite-courage-3n56p.firebasestorage.app",
  messagingSenderId: "308344252083",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-viralcatalystv40-44daeb9d-95dd-44dd-8a86-7e5d6ba898c0");

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/youtube.readonly");
// Ensure prompt is shown so user can authorize scopes
googleProvider.setCustomParameters({
  prompt: "consent"
});
