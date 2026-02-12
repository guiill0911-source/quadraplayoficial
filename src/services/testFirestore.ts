import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function criarTesteFirestore() {
  const docRef = await addDoc(collection(db, "testes"), {
    mensagem: "Conexão Firestore OK",
    criadoEm: new Date(),
  });

  return docRef.id;
}
