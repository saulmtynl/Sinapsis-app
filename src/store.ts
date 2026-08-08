import { create } from 'zustand'
import * as auth from './lib/auth'
import * as drive from './lib/driveClient'
import type { GoogleAccountInfo, MapStateBlock, MapStateJson, MapStateMedia } from './types'

export type Screen = 'login' | 'maps-list' | 'map-detail'
export type Tab = 'inbox' | 'mapas'
export type RecordableKind = 'audio' | 'video'

export interface CloudMapSummary {
  driveFolderId: string
  title: string
}

interface LoadedMap {
  driveFolderId: string
  stateFileId: string
  mediaFolderId: string | null
  remoteModifiedTime: string
  state: MapStateJson
}

interface SinapsisStore {
  tab: Tab
  setTab: (tab: Tab) => void

  screen: Screen
  account: GoogleAccountInfo
  authError: string | null

  maps: CloudMapSummary[]
  mapsLoading: boolean
  mapsError: string | null

  currentMap: LoadedMap | null
  mapLoading: boolean
  mapError: string | null
  // See saveMap() below for how this gets set/cleared — a real two-sided
  // conflict (edited here AND changed on Drive since we opened it) is
  // surfaced for an explicit choice, never auto-resolved. Milestone 9
  // spec §4.
  remoteChangedWarning: boolean

  // True as soon as any local edit happens; only saveMap() clears it.
  // Drives whether the save bar is active and (later) could gate a
  // "discard changes?" prompt on navigation.
  dirty: boolean
  saving: boolean
  saveError: string | null

  signIn: () => Promise<void>
  signOut: () => void
  loadMaps: () => Promise<void>
  openMap: (folder: CloudMapSummary) => Promise<void>
  backToList: () => void

  updateNodeTitle: (nodeId: string, title: string) => void
  updateBlockText: (blockId: string, textContent: string) => void
  addTextBlock: (nodeId: string) => void
  deleteBlock: (blockId: string) => void
  addMediaBlock: (nodeId: string, kind: RecordableKind, blob: Blob, extension: string) => Promise<void>

  saveMap: (opts?: { force?: boolean }) => Promise<void>
  discardAndReload: () => Promise<void>
}

function stripIdSuffix(name: string): string {
  return name.replace(/\s*\([0-9a-f]{8}\)$/i, '')
}

function nextOrderIndex(blocks: MapStateBlock[], nodeId: string): number {
  const forNode = blocks.filter((b) => b.nodeId === nodeId)
  if (forNode.length === 0) return 0
  return Math.max(...forNode.map((b) => b.orderIndex)) + 1
}

export const useStore = create<SinapsisStore>((set, get) => ({
  // Always starts on the Inbox tab (Milestone 2) — capturing a quick note
  // must never require signing in first. `screen` below only governs what
  // shows inside the "Mapas" tab, which is the one thing that still needs
  // a Google session.
  tab: 'inbox',
  setTab: (tab) => set({ tab }),

  screen: auth.getGoogleAccount().connected ? 'maps-list' : 'login',
  account: auth.getGoogleAccount(),
  authError: null,

  maps: [],
  mapsLoading: false,
  mapsError: null,

  currentMap: null,
  mapLoading: false,
  mapError: null,
  remoteChangedWarning: false,

  dirty: false,
  saving: false,
  saveError: null,

  signIn: async () => {
    set({ authError: null })
    try {
      const account = await auth.signIn()
      set({ account, screen: 'maps-list' })
    } catch (err) {
      set({ authError: err instanceof Error ? err.message : String(err) })
    }
  },

  signOut: () => {
    auth.signOut()
    set({ account: { connected: false, email: null }, screen: 'login', maps: [], currentMap: null, dirty: false })
  },

  loadMaps: async () => {
    set({ mapsLoading: true, mapsError: null })
    try {
      const folders = await drive.listMapFolders()
      const maps = folders.map((f) => ({ driveFolderId: f.id, title: stripIdSuffix(f.name) }))
      set({ maps, mapsLoading: false })
    } catch (err) {
      set({ mapsLoading: false, mapsError: err instanceof Error ? err.message : String(err) })
    }
  },

  openMap: async (folder) => {
    set({ mapLoading: true, mapError: null, remoteChangedWarning: false, dirty: false, saveError: null })
    try {
      const { stateFileId, mediaFolderId } = await drive.findMapFiles(folder.driveFolderId)
      if (!stateFileId) throw new Error('Este mapa no tiene un estado válido en Drive todavía.')

      const [state, meta] = await Promise.all([
        drive.downloadJson<MapStateJson>(stateFileId),
        drive.getFileMetadata(stateFileId)
      ])

      set({
        currentMap: {
          driveFolderId: folder.driveFolderId,
          stateFileId,
          mediaFolderId,
          remoteModifiedTime: meta?.modifiedTime ?? new Date().toISOString(),
          state
        },
        mapLoading: false,
        screen: 'map-detail'
      })
    } catch (err) {
      set({ mapLoading: false, mapError: err instanceof Error ? err.message : String(err) })
    }
  },

  backToList: () => set({ screen: 'maps-list', currentMap: null, dirty: false }),

  // ---------- local (in-memory) edits — nothing here touches Drive ----------

  updateNodeTitle: (nodeId, title) => {
    const current = get().currentMap
    if (!current) return
    const now = new Date().toISOString()
    set({
      currentMap: {
        ...current,
        state: {
          ...current.state,
          nodes: current.state.nodes.map((n) => (n.id === nodeId ? { ...n, title, updatedAt: now } : n))
        }
      },
      dirty: true
    })
  },

  updateBlockText: (blockId, textContent) => {
    const current = get().currentMap
    if (!current) return
    set({
      currentMap: {
        ...current,
        state: {
          ...current.state,
          blocks: current.state.blocks.map((b) => (b.id === blockId ? { ...b, textContent } : b))
        }
      },
      dirty: true
    })
  },

  addTextBlock: (nodeId) => {
    const current = get().currentMap
    if (!current) return
    const block: MapStateBlock = {
      id: crypto.randomUUID(),
      nodeId,
      type: 'text',
      orderIndex: nextOrderIndex(current.state.blocks, nodeId),
      textContent: '',
      mediaId: null,
      createdAt: new Date().toISOString()
    }
    set({
      currentMap: { ...current, state: { ...current.state, blocks: [...current.state.blocks, block] } },
      dirty: true
    })
  },

  deleteBlock: (blockId) => {
    const current = get().currentMap
    if (!current) return
    set({
      currentMap: {
        ...current,
        state: { ...current.state, blocks: current.state.blocks.filter((b) => b.id !== blockId) }
      },
      dirty: true
    })
  },

  // Uploads the binary to Drive right away (same eager-media-upload order as
  // desktop's uploadPendingMedia before uploadMap) so a re-recording after a
  // reload never re-uploads a duplicate — only the state.json write, which
  // references it, is deferred to the explicit Guardar.
  addMediaBlock: async (nodeId, kind, blob, extension) => {
    const current = get().currentMap
    if (!current) throw new Error('No hay ningún mapa abierto.')
    if (!current.mediaFolderId) throw new Error('Este mapa no tiene una subcarpeta de media en Drive.')

    const filename = `grabacion-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`
    const driveFileId = await drive.uploadFile(current.mediaFolderId, blob, filename)

    const now = new Date().toISOString()
    const media: MapStateMedia = {
      id: crypto.randomUUID(),
      nodeId,
      type: kind,
      originalFilename: filename,
      canvasX: null,
      canvasY: null,
      createdAt: now,
      driveFileId
    }
    const block: MapStateBlock = {
      id: crypto.randomUUID(),
      nodeId,
      type: kind,
      orderIndex: nextOrderIndex(current.state.blocks, nodeId),
      textContent: null,
      mediaId: media.id,
      createdAt: now
    }

    // Re-read currentMap in case something else changed it while the
    // upload was in flight (uploadFile can take a while for video).
    const latest = get().currentMap
    if (!latest) return
    set({
      currentMap: {
        ...latest,
        state: {
          ...latest.state,
          media: [...latest.state.media, media],
          blocks: [...latest.state.blocks, block]
        }
      },
      dirty: true
    })
  },

  // ---------- save to Drive ----------

  saveMap: async (opts) => {
    const current = get().currentMap
    if (!current) return
    set({ saving: true, saveError: null })
    try {
      if (!opts?.force) {
        const meta = await drive.getFileMetadata(current.stateFileId)
        if (meta && meta.modifiedTime !== current.remoteModifiedTime) {
          set({ saving: false, remoteChangedWarning: true })
          return
        }
      }

      const uploaded = await drive.uploadJson(
        current.driveFolderId,
        'state.json',
        current.state,
        current.stateFileId
      )
      set({
        currentMap: { ...current, stateFileId: uploaded.fileId, remoteModifiedTime: uploaded.modifiedTime },
        dirty: false,
        saving: false,
        remoteChangedWarning: false
      })
    } catch (err) {
      set({ saving: false, saveError: err instanceof Error ? err.message : String(err) })
    }
  },

  // The "descartar mis cambios" side of the conflict prompt: throws away
  // local edits and re-downloads the current remote state.json.
  discardAndReload: async () => {
    const current = get().currentMap
    if (!current) return
    await get().openMap({ driveFolderId: current.driveFolderId, title: '' })
  }
}))
