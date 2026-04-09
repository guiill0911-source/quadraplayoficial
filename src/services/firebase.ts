import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCv98k0BgrYAAOasdevS_Kkr8A0NZUvkSk",
  authDomain: "quadraplayoficial.firebaseapp.com",
  projectId: "quadraplayoficial",
  storageBucket: "quadraplayoficial.firebasestorage.app",
  messagingSenderId: "550982011848",
  appId: "1:550982011848:web:f6cdbff5b15c05454ccefd",
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
auth.languageCode = "pt-BR";

export const storage = getStorage(
  app,
  "gs://quadraplayoficial.firebasestorage.app"
);