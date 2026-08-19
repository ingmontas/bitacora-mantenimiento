/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE FIREBASE — PEGA AQUÍ TUS DATOS
   ═══════════════════════════════════════════════════════════════
   1. Ve a https://console.firebase.google.com → crea un proyecto (gratis).
   2. Dentro del proyecto: ⚙️ Configuración del proyecto → baja hasta
      "Tus apps" → ícono </> (Web) → dale un nombre → "Registrar app".
   3. Firebase te muestra un bloque "firebaseConfig = {...}". Copia esos
      valores y reemplázalos abajo (NO necesitas hacer nada más ahí).
   4. Guarda este archivo y súbelo junto con los demás a GitHub Pages.

   Sigue las instrucciones completas en INSTRUCCIONES.md — incluyen
   cómo activar Firestore, Authentication (anónima) y Storage, y cómo
   pegar las reglas de seguridad (firestore.rules / storage.rules).
   ═══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyDGCNn6I3KBAPX3uKWFI9xTGfN_4yNAUt8",
  authDomain: "mantenimiento-planta-174c2.firebaseapp.com",
  projectId: "mantenimiento-planta-174c2",
  storageBucket: "mantenimiento-planta-174c2.firebasestorage.app",
  messagingSenderId: "1098102717611",
  appId: "1:1098102717611:web:b91ef5c331ee6470c5cbee"
};
