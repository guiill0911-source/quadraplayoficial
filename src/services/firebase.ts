import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCv98k0BgrYAAOasdevS_Kkr8A0NZUvkSk",
  authDomain: "quadraplayoficial.firebaseapp.com",
  projectId: "quadraplayoficial",
  messagingSenderId: "550982011848",
  appId: "1:550982011848:web:f6cdbff5b15c05454ccefd",
};

// inicializa app
const app = initializeApp(firebaseConfig);

// serviços
export const db = getFirestore(app);
export const auth = getAuth(app);

// ⚠️ AQUI ESTÁ A CORREÇÃO CRÍTICA
export const storage = getStorage(
  app,
  "gs://quadraplayoficial.firebasestorage.app"
);
