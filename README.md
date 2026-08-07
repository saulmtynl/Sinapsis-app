# Sinapsis PWA (Milestone 9)

Versión web instalable de Sinapsis para Android. Lee y escribe los mismos
mapas que la app de escritorio (Electron), vía Google Drive — no tiene base
de datos local propia. Ver `docs/drive-sync-format.md` para el formato de
`state.json` que ambas apps comparten.

Proyecto independiente del repo de Electron (`../Sinapsis`): stack propio
(Vite + React + TypeScript), pensado para desplegarse como sitio estático en
GitHub Pages.

## Estado actual (scaffolding)

Lo que ya funciona:

- Login con Google (Identity Services, sin client secret).
- Listado de mapas de la carpeta `Sinapsis` en Drive.
- Apertura de un mapa: descarga su `state.json`, muestra el árbol de nodos
  (lista expandible) y, al seleccionar un nodo, sus bloques y documentos —
  **solo lectura** por ahora.
- Detección de que el mapa cambió en Drive desde que se abrió (banner de
  aviso), aunque el flujo de guardado que la dispara todavía no existe.
- Manifest + service worker mínimo (cachea solo el shell estático, nunca
  datos de Drive) → instalable en Android vía "Agregar a pantalla de inicio".
- Banner de "sin conexión".

Lo que falta (siguiente iteración, ver el brief del Milestone 9):

- Edición de bloques/nodos y guardado explícito a Drive.
- Grabación de audio/video (`getUserMedia` + `MediaRecorder`) y subida a la
  subcarpeta `media/`.
- Decidir la interacción final de guardado (¿botón explícito o on-blur?) y
  si la lista expandible del árbol es la forma definitiva de navegar en
  pantalla chica — quedaron como preguntas abiertas para el usuario.

## Setup

```bash
npm install
cp .env.example .env
# completar VITE_GOOGLE_CLIENT_ID en .env — ver instrucciones dentro del archivo
npm run dev
```

### Client ID de Google

1. Google Cloud Console → **APIs & Services → Credentials → Create
   Credentials → OAuth client ID**.
2. Tipo de aplicación: **Web application**.
3. **Authorized JavaScript origins**: agregar `http://localhost:5173` (dev) y
   la URL final de GitHub Pages (ej. `https://<usuario>.github.io/<repo>/`).
4. No hace falta "Authorized redirect URIs" — el flujo de token client de
   Google Identity Services no redirige.
5. Copiar el Client ID (no el secret — este flujo no lo usa) a `.env`.

El mismo proyecto de Google Cloud de escritorio sirve; solo hay que crear
este client OAuth adicional de tipo "Web application" ahí (distinto del
"Desktop app" que ya usa Electron).

## Deploy a GitHub Pages

Ya incluido: `.github/workflows/deploy.yml`, que compila y publica a Pages en
cada push a `main`.

1. En el repo de GitHub: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**:
   `VITE_GOOGLE_CLIENT_ID` con el mismo valor que en `.env`.
3. Agregar la URL resultante (`https://<usuario>.github.io/<repo>/`) a los
   *Authorized JavaScript origins* del Client ID (paso 3 de arriba) — Google
   la rechaza si no está en la lista.
4. Push a `main`.

## Notas de implementación

- `src/lib/auth.ts` — Google Identity Services (token client), token en
  memoria únicamente, nunca en `localStorage`.
- `src/lib/driveClient.ts` — mismos endpoints de Drive v3 que
  `../Sinapsis/src/main/sync/driveClient.ts` (desktop), adaptado a
  `fetch`/`Blob` de navegador en vez de streams de Node.
- `src/types.ts` — `MapStateJson` y tipos relacionados, copiados tal cual del
  formato de desktop (Milestone 8). No cambiar sin sincronizar con desktop.
- Iconos en `public/icons/` son placeholders (SVG con una "S") — reemplazar
  por el ícono real de Sinapsis antes de publicar, idealmente agregando
  también PNGs de 192/512px para mejor compatibilidad en Android.
