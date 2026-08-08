// Local-only staging area for the Inbox (Milestone 2). Deliberately not
// Drive: capture must work with zero network/auth dependency, so items
// live in IndexedDB (native, no library needed for one object store) until
// "Organizar" turns one into a real block in a map's state.json.
import type { InboxItem } from '../types'

const DB_NAME = 'sinapsis-inbox'
const DB_VERSION = 1
const STORE_NAME = 'items'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir la base de datos local.'))
  })
}

export async function getAllInboxItems(): Promise<InboxItem[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as InboxItem[])
    req.onerror = () => reject(req.error ?? new Error('No se pudieron leer los ítems del inbox.'))
  })
}

export async function putInboxItem(item: InboxItem): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar el ítem en el inbox.'))
  })
}

export async function deleteInboxItem(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo borrar el ítem del inbox.'))
  })
}
