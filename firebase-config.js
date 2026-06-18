import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getFirestore
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyASrR7aRXcroZlBRKm7uxL_hENTjrCrS94",
  authDomain: "lnjpit-study-tracker.firebaseapp.com",
  projectId: "lnjpit-study-tracker",
  storageBucket: "lnjpit-study-tracker.firebasestorage.app",
  messagingSenderId: "759456255781",
  appId: "1:759456255781:web:c79ce48fcb32286c5054cc",
  measurementId: "G-L1Y8XRHDG1"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);