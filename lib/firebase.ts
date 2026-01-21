// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD14Zxgtc70K3R-q5dhzCPsEt-fLsF6NKw",
  authDomain: "winsam-lotto-good-place.firebaseapp.com",
  projectId: "winsam-lotto-good-place",
  storageBucket: "winsam-lotto-good-place.firebasestorage.app",
  messagingSenderId: "725603058217",
  appId: "1:725603058217:web:d022f8865f4f8a33385238",
  measurementId: "G-QZ9TZ52KJ9",
};

// 앱이 이미 초기화되어 있으면 기존 앱을 쓰고, 아니면 새로 초기화
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
