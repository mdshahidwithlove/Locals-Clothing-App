import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDs1LdPhLRYv7suAyBRgYFZFChhgZJiEhc",
  authDomain: "locals-6a592.firebaseapp.com",
  projectId: "locals-6a592",
  storageBucket: "locals-6a592.firebasestorage.app",
  messagingSenderId: "78798009324",
  appId: "1:78798009324:web:887177a8911a2d3775c6c9",
  measurementId: "G-035RVJ63ZZ"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export default app;
