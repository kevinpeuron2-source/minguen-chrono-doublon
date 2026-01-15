
import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDd4OniQFy8PT2TnMaV25UEF99dgKaXZnU",
  authDomain: "minguen-chrono-c5f35.firebaseapp.com",
  projectId: "minguen-chrono-c5f35",
  storageBucket: "minguen-chrono-c5f35.firebasestorage.app",
  messagingSenderId: "207278231646",
  appId: "1:207278231646:web:13c5d869c9120092f8a4cf"
};

const app = initializeApp(firebaseConfig);

// Activation du cache persistant pour le mode hors-ligne (crucial pour les signaleurs)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
