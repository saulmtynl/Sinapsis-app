# Formato de sincronización con Google Drive (heredado del Milestone 8, app de escritorio)

Referencia extraída tal cual de `Sinapsis/src/main/sync/`. La PWA (Milestone 9)
debe leer y escribir el `state.json` de esta página — no inventar un formato
nuevo — pero **no necesita replicar la estructura de carpetas por nodo**
descripta abajo (eso es Milestone 10 de escritorio, fuera del alcance de la
PWA por ahora; ver nota al final de esta sección).

## Estructura en Drive (actualizada, Milestone 10)

```
Sinapsis/                                    (carpeta raíz, una por cuenta de Google)
  <título del tema_base> (<id-corto>)/       (= la carpeta del mapa; el tema_base ES un nodo más)
    state.json                               (árbol completo del mapa — sigue siendo UN solo archivo)
    documentos/                              (guiones/textos de ESTE nodo, como .txt)
    audios/                                  (audio de ESTE nodo)
    media/                                   (video/imagen de ESTE nodo)
    <título del exponente> (<id-corto>)/     (nodo hijo — misma estructura interna, recursiva; SIN state.json propio)
      documentos/ audios/ media/
      <título del subtema> (<id-corto>)/
        documentos/ audios/ media/
```

- La carpeta raíz `Sinapsis` se busca/crea por nombre bajo `root` en el Drive del usuario.
- El nombre de cada carpeta de nodo (mapa incluido, ya que el mapa es su propio tema_base)
  es `"<título saneado, máx 120 chars> (<primeros 8 chars del id>)"`, para que dos nodos con
  el mismo título — hermanos o no — no choquen.
- **`state.json` sigue siendo el único archivo que la app realmente lee/escribe para
  sincronizar** — contiene el árbol completo (todos los nodos/bloques/documentos/media, plano,
  como antes). Las carpetas por nodo y sus `documentos/`/`audios`/`media/` son una copia
  **paralela, navegable a mano**, poblada a partir de esos mismos datos en cada sync — no una
  fuente de verdad nueva ni un mecanismo de sync distinto.
- **Eliminar un nodo mueve su carpeta a la papelera de Drive** (recuperable desde Drive), nunca
  borrado permanente. Drive arrastra todo lo anidado adentro (subcarpetas, archivos, nodos
  hijos) al mover la carpeta del nodo eliminado.

**Nota para la PWA:** como la PWA solo lee `state.json` por su id de archivo directo (nunca
necesita listar ni crear carpetas para eso), esta estructura de carpetas no le afecta en nada
mientras siga siendo de solo lectura. Si en el futuro la PWA agrega escritura (guardado
explícito, milestone propio), en ese momento hay que decidir si también reconcilia la
estructura de carpetas o si eso queda exclusivamente a cargo de escritorio en su próximo sync
— no asumir que la PWA tiene que replicar `reconcileNodeFolders` tal cual.

## `state.json` — wire format

```ts
interface MapStateJson {
  version: 1
  mapId: string
  nodes: Array<{
    id: string
    parentId: string | null
    title: string
    type: string
    orderIndex: number
    createdAt: string
    updatedAt: string
  }>
  blocks: Array<{
    id: string
    nodeId: string
    type: string
    orderIndex: number
    textContent: string | null
    mediaId: string | null
    createdAt: string
  }>
  documents: Array<{
    id: string
    nodeId: string
    title: string
    content: string
    source: string
    wordCount: number
    createdAt: string
    updatedAt: string
    driveFileId?: string | null   // id del .txt espejo en documentos/ (Milestone 10). Opcional
                                    // para que un state.json viejo (sin este campo) siga
                                    // parseando — tratar ausencia como null.
  }>
  media: Array<{
    id: string
    nodeId: string
    type: string
    originalFilename: string
    canvasX: number | null
    canvasY: number | null
    createdAt: string
    driveFileId: string | null   // referencia al archivo real, subido aparte a media/
  }>
}
```

Notas de cada array:

- **nodes**: el árbol del mapa. El nodo raíz (el mapa mismo) tiene `parentId: null`.
  `type` distingue tema base / exponente / subtema, etc. (mismos valores que usa escritorio).
- **blocks**: los bloques tipo chat dentro de cada nodo (texto, referencia a audio/video/imagen
  vía `mediaId`). `textContent` es null en bloques de solo media.
- **documents**: la pestaña de Documentos (Milestone 7) — contenido largo tipo guion/artículo.
  `driveFileId` referencia su copia `.txt` en `documentos/` (Milestone 10); no es la fuente de
  verdad del contenido, que sigue siendo `content` acá mismo.
- **media**: metadata de cada archivo binario. El archivo real vive en la subcarpeta `media/`
  de Drive; `driveFileId` es el id de ese archivo. Si `driveFileId` es `null`, el archivo
  todavía no se subió (pendiente).

## Mecánica que debe replicarse (no solo el shape del JSON)

1. **Binarios fuera del JSON.** Los archivos de audio/video/imagen se suben sueltos a la
   subcarpeta `media/` (upload resumable en escritorio; en la PWA puede ser simple porque los
   archivos grabados desde el navegador son más chicos, pero el patrón de "subir el binario
   primero, luego escribir su `driveFileId` en el array `media` del JSON" debe mantenerse).

2. **`version: 1` fijo.** Permite evolucionar el schema a futuro. La PWA debe escribir
   `version: 1` también, y puede usarlo para detectar si algún día aparece un `state.json`
   con un formato más nuevo que no sepa leer.

3. **Reemplazo todo-o-nada al descargar.** Escritorio no hace merge campo a campo: al bajar
   un `state.json`, borra el subtree local completo y lo reinserta desde cero. La PWA no tiene
   base de datos local persistente (todo viene de Drive en cada sesión), así que esto aplica
   menos, pero es relevante para la subida: si el usuario edita un mapa en la PWA, debe subir
   el árbol completo actualizado, no un diff.

4. **Detección de conflicto vía `modifiedTime` de Drive, nunca el reloj local.** Antes de
   sobrescribir, comparar el `modifiedTime` que devuelve la Drive API contra el último
   `modifiedTime` visto por esta sesión — igual que hace escritorio en `mapSync.ts`
   (`syncMapNow`). Esto evita problemas de desfase de reloj entre el celular y la PC.
   Ver sección 4 del brief del Milestone 9: "antes de cargar un mapa, comparar el
   `modifiedTime` de Drive contra la última versión vista".

5. **Subida como `multipart/related`.** El `state.json` es texto chico, así que un solo
   POST/PATCH multipart (metadata + contenido JSON) alcanza — no hace falta el protocolo
   resumable que sí se usa para los archivos de media.

## Dónde está el código fuente original (para consulta, no para copiar tal cual — es Node/Electron)

- `Sinapsis/src/main/sync/mapSync.ts` — arma y parsea el `MapStateJson` (`exportMapState` /
  `importMapState`), y la lógica de decisión de sync (`syncMapNow`: upload / download / conflict).
- `Sinapsis/src/main/sync/driveClient.ts` — llamadas crudas a la API de Drive v3 (`uploadJson`,
  `uploadText`, `downloadJson`, `getFileMetadata`, `uploadFile` resumable, `createMapRootFolder`,
  `findOrCreateChildFolder`, `trashFile`/`renameFile`/`moveFile` (Milestone 10), `listMapFolders`).
- `Sinapsis/src/main/sync/googleAuth.ts` — auth de escritorio (OAuth con client secret,
  loopback local). **No aplica a la PWA** — Milestone 9 usa Google Identity Services
  (token client, sin secret) en su lugar; solo el scope (`drive.file`) se reutiliza igual.
- `Sinapsis/src/main/sync/engine.ts` — el tick de sync automático cada 15s. Tampoco aplica
  tal cual a la PWA (guardado explícito/on-blur en vez de polling en background), pero sirve
  de referencia para el patrón de "un tick a la vez, nunca en paralelo".
