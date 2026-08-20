import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // <-- 1. Importamos Autenticación

// Tu configuración web de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBnDPdiEiOXNnz0Bm7wHjBRpHbQaBLDvT0",
  authDomain: "aula-plus-elioenai.firebaseapp.com",
  projectId: "aula-plus-elioenai",
  storageBucket: "aula-plus-elioenai.firebasestorage.app",
  messagingSenderId: "418562381707",
  appId: "1:418562381707:web:725e3c3484ec4d8006818e"
};

// Inicializamos la aplicación
const app = initializeApp(firebaseConfig);

// Exportamos la conexión a Firestore para usarla en nuestros formularios
export const db = getFirestore(app);

// 2. Exportamos los servicios de Autenticación para usarlos en el Login
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();