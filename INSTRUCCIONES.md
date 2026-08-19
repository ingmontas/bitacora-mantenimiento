# Mantenimiento 2026 — Bitácora + Inventario + Análisis (con Firebase)

Esta carpeta convierte tus tres herramientas (Bitácora, Inventario, Análisis) en
**una sola app instalable**, con una **base de datos compartida en la nube**
(Firebase) para que varios celulares vean y editen los mismos datos en tiempo
real — sin depender de Microsoft 365/SharePoint.

Costo: **$0**. El plan gratuito de Firebase (Spark) alcanza de sobra para el
uso de una planta con varios técnicos.

---

## 1. Crea el proyecto de Firebase (5 minutos)

1. Ve a **https://console.firebase.google.com** e inicia sesión con una
   cuenta de Google (puede ser una nueva, dedicada a la empresa).
2. Clic en **"Crear un proyecto"**. Ponle un nombre, por ejemplo
   `mantenimiento-planta`. Puedes desactivar Google Analytics (no hace falta).
3. Espera a que termine de crearse.

### 1.1 Activa Firestore (la base de datos)
- En el menú izquierdo: **Compilación → Firestore Database → Crear base de datos**.
- Elige una ubicación cercana (por ejemplo `us-east1` o `southamerica-east1`).
- Modo: **producción** (no "modo de prueba").
- Una vez creada, ve a la pestaña **Reglas** y reemplaza el contenido por el
  del archivo `firestore.rules` de esta carpeta. Clic en **Publicar**.

### 1.2 Activa la autenticación anónima
- **Compilación → Authentication → Comenzar → Método de acceso**.
- Habilita **Anónimo** (Anonymous). No requiere que nadie cree usuario ni
  contraseña — la app inicia sesión anónima sola, en silencio.

### 1.3 Activa Storage (para fotos de repuestos y manuales PDF)
- **Compilación → Storage → Comenzar**. Acepta la ubicación por defecto.
- Ve a la pestaña **Reglas** y reemplaza el contenido por el del archivo
  `storage.rules` de esta carpeta. Clic en **Publicar**.

### 1.4 Registra la app web y copia la configuración
- En la página principal del proyecto (ícono de engranaje ⚙️ →
  **Configuración del proyecto**), baja hasta **"Tus apps"** y haz clic en el
  ícono **</>** (Web).
- Dale un nombre (por ejemplo "Mantenimiento web") y clic en **Registrar app**.
  **No** actives "Firebase Hosting" (usaremos GitHub Pages, que ya tienes).
- Verás un bloque de código con `const firebaseConfig = { apiKey: "...", ... }`.
  Copia esos valores y pégalos en el archivo **`firebase-config.js`** de esta
  carpeta, reemplazando los `PEGA_AQUI_TU_...`.

Con esto, Firebase ya queda configurado. Los pasos 1.1–1.4 se hacen **una
sola vez**; después de esto nadie más necesita tocar la consola de Firebase.

---

## 2. Publica los archivos (GitHub Pages, igual que ya tienes)

1. Reemplaza el contenido de tu repositorio `bitacora-mantenimiento` (o crea
   uno nuevo) con **todos los archivos de esta carpeta**:
   - `index.html`, `bitacora.html`, `inventario.html`, `analisis.html`
   - `firebase-config.js`, `firebase-init.js`
   - `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`
   - `tecnicos.json`
2. Haz commit y push. Si GitHub Pages ya estaba activado en ese repo, en 1-2
   minutos los cambios estarán en tu misma URL
   (`https://ingmontas.github.io/bitacora-mantenimiento/`).
3. Abre esa URL — ahora es una página de inicio con 3 botones: **Bitácora**,
   **Inventario** y **Análisis**.

La primera vez que alguien abra Inventario o Análisis, la app sube
automáticamente a Firebase los datos que ya tenías precargados (el inventario
de la VALVE ASSEMBLY, el histórico de OTs, etc.) — no se pierde nada. Eso
pasa **una sola vez**; después todos leen y escriben la misma base de datos.

---

## 3. Instálala como app en los celulares

En cada celular, abre la URL de `index.html` y:
- **Android (Chrome):** menú ⋮ → "Agregar a pantalla de inicio".
- **iPhone (Safari):** botón compartir 📤 → "En la pantalla de inicio".

Queda como un ícono normal, a pantalla completa, sin la barra del navegador.

---

## 4. Cómo funciona la sincronización

- Cualquier OT, equipo, repuesto o movimiento de stock que se guarde en un
  celular aparece en los demás **en segundos**, sin tocar ningún botón de
  "actualizar" (a diferencia del enfoque anterior con SharePoint).
- Si un celular no tiene señal, los cambios se guardan en el dispositivo y se
  suben solos apenas recupera conexión — no se pierde nada.
- **Análisis** ahora lee en vivo las mismas órdenes de trabajo que se cargan
  en **Bitácora** (y las que ya tenía precargadas). El cuadro para "pegar
  filas nuevas" en Análisis sigue disponible, pero solo para cargar en bloque
  OTs viejas que tengas en Excel — ya no hace falta para el uso diario.
- La clave (PIN) para eliminar repuestos/equipos en Inventario ahora es
  **una sola, compartida entre todos los celulares** (antes cada celular
  tenía la suya).

### Límite a tener en cuenta
Si **dos técnicos editan el mismo equipo al mismo tiempo** (por ejemplo,
ambos agregan un repuesto distinto a "VALVE ASSEMBLY" en el mismo segundo),
es posible que el segundo guardado sobrescriba al primero, porque cada
guardado sube la lista completa de repuestos de ese equipo. En la práctica,
con técnicos trabajando en momentos distintos esto casi nunca pasa — pero si
notas que se pierde algo, dilo y lo ajustamos (la solución sería mover cada
repuesto a su propio documento en la base de datos).

---

## 5. Administrar la lista de técnicos

Sigue igual que antes: edita el archivo `tecnicos.json` en GitHub (agregar,
quitar o renombrar un técnico) y haz commit. Todos los celulares lo ven
actualizado la próxima vez que abran la app — sin tocar código.

---

## 6. Seguridad — qué tan expuesto queda esto

- La `apiKey` de Firebase que va en `firebase-config.js` **no es secreta por
  diseño** (Google la documenta así): identifica el proyecto, no autoriza
  nada por sí sola. Lo que protege tus datos son las **reglas** de Firestore
  y Storage (pasos 1.1 y 1.3) — solo alguien que pase por la autenticación
  anónima de tu app puede leer/escribir.
- Cualquiera con el link de tu app podría, técnicamente, autenticarse de
  forma anónima igual que un técnico legítimo. Para un uso interno de
  planta esto es un riesgo bajo (nadie externo conoce la URL ni tiene motivo
  para buscarla), pero si más adelante quieres subirle el nivel de
  seguridad, se puede agregar una pantalla de acceso con código/contraseña
  compartido, o pasar a login real por correo — dilo cuando quieras y lo
  añadimos.
- En **Google Cloud Console → APIs y servicios → Credenciales**, puedes
  además restringir la `apiKey` para que solo funcione desde tu dominio de
  GitHub Pages (`ingmontas.github.io`). Es un paso opcional recomendado una
  vez que ya probaste que todo funciona.

---

## 7. Si algo no conecta

- Revisa que copiaste bien los 6 valores en `firebase-config.js` (sin
  comillas de más ni espacios).
- Revisa en la consola de Firebase que Firestore, Authentication (Anónimo) y
  Storage estén **activados** (no solo creados).
- Revisa que publicaste las reglas (`firestore.rules` / `storage.rules`) — si
  quedan en "modo de prueba" caducan solas a los 30 días y la app deja de
  poder escribir.
- Abre las herramientas de desarrollador del navegador (F12 → pestaña
  "Consola") para ver el mensaje de error exacto si algo falla.
