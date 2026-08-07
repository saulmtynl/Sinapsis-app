// Browser port of Sinapsis/src/main/sync/driveClient.ts (Milestone 8). Same
// Drive v3 endpoints and request shapes as desktop; the only real
// differences are: no Node fs/streams (Blob/File instead), and the access
// token comes from auth.ts's in-memory GIS session instead of a
// refresh-token flow.
import { getAccessToken } from './auth'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const ROOT_FOLDER_NAME = 'Sinapsis'
const MEDIA_SUBFOLDER_NAME = 'media'

// The root folder id isn't secret (just a Drive object id) and never
// changes for a given account, so it's worth caching across sessions —
// unlike the access token, which stays in-memory only.
const ROOT_FOLDER_CACHE_KEY = 'sinapsis:driveRootFolderId'

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${getAccessToken()}` }
}

async function driveFetch<T>(pathAndQuery: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${DRIVE_API}${pathAndQuery}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) }
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Error de Google Drive (HTTP ${res.status}).`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

async function createFolder(name: string, parentId: string): Promise<string> {
  const created = await driveFetch<{ id: string }>('/files', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] })
  })
  return created.id
}

export async function ensureRootFolder(): Promise<string> {
  const cached = localStorage.getItem(ROOT_FOLDER_CACHE_KEY)
  if (cached) return cached

  const query = `name = '${ROOT_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`
  const found = await driveFetch<{ files: Array<{ id: string }> }>(
    `/files?q=${encodeURIComponent(query)}&fields=files(id)`
  )
  const id = found.files[0]?.id ?? (await createFolder(ROOT_FOLDER_NAME, 'root'))
  localStorage.setItem(ROOT_FOLDER_CACHE_KEY, id)
  return id
}

function sanitizeFolderName(name: string): string {
  return name.trim().slice(0, 120) || 'Mapa sin título'
}

// Same naming convention as desktop ("<título> (<id-corto>)") so both apps
// recognize each other's map folders in Drive.
export async function createMapFolder(
  title: string,
  mapId: string
): Promise<{ folderId: string; mediaFolderId: string }> {
  const rootId = await ensureRootFolder()
  const name = `${sanitizeFolderName(title)} (${mapId.slice(0, 8)})`
  const folderId = await createFolder(name, rootId)
  const mediaFolderId = await createFolder(MEDIA_SUBFOLDER_NAME, folderId)
  return { folderId, mediaFolderId }
}

export async function listMapFolders(): Promise<Array<{ id: string; name: string }>> {
  const rootId = await ensureRootFolder()
  const query = `'${rootId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`
  const result = await driveFetch<{ files: Array<{ id: string; name: string }> }>(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=200`
  )
  return result.files
}

export async function findMapFiles(
  mapFolderId: string
): Promise<{ stateFileId: string | null; mediaFolderId: string | null }> {
  const query = `'${mapFolderId}' in parents and trashed = false`
  const result = await driveFetch<{ files: Array<{ id: string; name: string; mimeType: string }> }>(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&pageSize=50`
  )
  const stateFile = result.files.find((f) => f.name === 'state.json')
  const mediaFolder = result.files.find((f) => f.name === MEDIA_SUBFOLDER_NAME && f.mimeType === FOLDER_MIME)
  return { stateFileId: stateFile?.id ?? null, mediaFolderId: mediaFolder?.id ?? null }
}

function multipartBody(boundary: string, metadata: unknown, content: string): string {
  return (
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`
  )
}

// state.json is small text, so a plain multipart upload (metadata + content
// in one request) is enough — same as desktop, never the resumable protocol.
export async function uploadJson(
  folderId: string,
  filename: string,
  data: unknown,
  existingFileId?: string | null
): Promise<{ fileId: string; modifiedTime: string }> {
  const boundary = `sinapsis-${crypto.randomUUID()}`
  const metadata = existingFileId ? { name: filename } : { name: filename, parents: [folderId] }
  const body = multipartBody(boundary, metadata, JSON.stringify(data))

  const path = existingFileId
    ? `/files/${existingFileId}?uploadType=multipart&fields=id,modifiedTime`
    : `/files?uploadType=multipart&fields=id,modifiedTime`
  const method = existingFileId ? 'PATCH' : 'POST'

  const res = await fetch(`${DRIVE_UPLOAD_API}${path}`, {
    method,
    headers: { ...authHeaders(), 'content-type': `multipart/related; boundary=${boundary}` },
    body
  })
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(errBody?.error?.message ?? `No se pudo subir el estado del mapa a Drive (HTTP ${res.status}).`)
  }
  const uploaded = (await res.json()) as { id: string; modifiedTime: string }
  return { fileId: uploaded.id, modifiedTime: uploaded.modifiedTime }
}

export async function downloadJson<T>(fileId: string): Promise<T> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`No se pudo descargar el estado del mapa desde Drive (HTTP ${res.status}).`)
  return (await res.json()) as T
}

// Returns null for a 404 (file removed on the Drive side, or first sync)
// rather than throwing — callers treat "no remote state yet" as a normal case.
export async function getFileMetadata(fileId: string): Promise<{ modifiedTime: string } | null> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=modifiedTime`, { headers: authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`No se pudo consultar el mapa en Drive (HTTP ${res.status}).`)
  return (await res.json()) as { modifiedTime: string }
}

// Always resumable, regardless of size — mirrors desktop's rationale
// (reliability for anything past a few MB), which matters here too since
// recorded video from the phone camera can get large.
export async function uploadFile(folderId: string, file: Blob, filename: string): Promise<string> {
  const initRes = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ name: filename, parents: [folderId] })
  })
  if (!initRes.ok) throw new Error(`No se pudo iniciar la subida a Drive (HTTP ${initRes.status}).`)
  const sessionUrl = initRes.headers.get('location')
  if (!sessionUrl) throw new Error('Google Drive no devolvió una URL de sesión de subida.')

  const uploadRes = await fetch(sessionUrl, {
    method: 'PUT',
    headers: { 'content-length': String(file.size) },
    body: file
  })
  if (!uploadRes.ok) throw new Error(`No se pudo subir el archivo a Drive (HTTP ${uploadRes.status}).`)

  const body = (await uploadRes.json()) as { id: string }
  return body.id
}

// Returns a Blob (for <audio>/<video> src via URL.createObjectURL) instead
// of writing to disk — the PWA has no local filesystem to write into.
export async function downloadFile(fileId: string): Promise<Blob> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`No se pudo descargar el archivo de Drive (HTTP ${res.status}).`)
  return res.blob()
}

// Best-effort — used only when explicitly deleting a synced item.
export async function deleteFile(fileId: string): Promise<void> {
  try {
    await driveFetch(`/files/${fileId}`, { method: 'DELETE' })
  } catch {
    // ignore
  }
}
