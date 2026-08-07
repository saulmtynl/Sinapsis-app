import { create } from 'zustand'
import * as auth from './lib/auth'
import * as drive from './lib/driveClient'
import type { GoogleAccountInfo, MapStateJson } from './types'

export type Screen = 'login' | 'maps-list' | 'map-detail'

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
  screen: Screen
  account: GoogleAccountInfo
  authError: string | null

  maps: CloudMapSummary[]
  mapsLoading: boolean
  mapsError: string | null

  currentMap: LoadedMap | null
  mapLoading: boolean
  mapError: string | null
  // Set when a fresh check right before opening a map finds a newer
  // modifiedTime than what this screen last saw — see Milestone 9 spec §4
  // ("comparar el modifiedTime de Drive... para evitar sobrescribir cambios
  // hechos desde una PC sin que la PWA se entere"). Surfaced as a banner
  // rather than silently reloading, so an in-progress edit is never discarded.
  remoteChangedWarning: boolean

  signIn: () => Promise<void>
  signOut: () => void
  loadMaps: () => Promise<void>
  openMap: (folder: CloudMapSummary) => Promise<void>
  refreshCurrentMapMeta: () => Promise<void>
  backToList: () => void
}

function stripIdSuffix(name: string): string {
  return name.replace(/\s*\([0-9a-f]{8}\)$/i, '')
}

export const useStore = create<SinapsisStore>((set, get) => ({
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
    set({ account: { connected: false, email: null }, screen: 'login', maps: [], currentMap: null })
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
    set({ mapLoading: true, mapError: null, remoteChangedWarning: false })
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

  // Cheap metadata-only check, meant to be called right before a save so a
  // stale edit never clobbers a change made from another device in between.
  refreshCurrentMapMeta: async () => {
    const current = get().currentMap
    if (!current) return
    const meta = await drive.getFileMetadata(current.stateFileId)
    if (meta && meta.modifiedTime !== current.remoteModifiedTime) {
      set({ remoteChangedWarning: true })
    }
  },

  backToList: () => set({ screen: 'maps-list', currentMap: null })
}))
