// Wire format for each map's state.json in Drive. Ported as-is from the
// desktop app (Sinapsis/src/main/sync/mapSync.ts, Milestone 8) — see
// docs/drive-sync-format.md for the full explanation. Do not change field
// names/shapes here without also changing them on desktop; both apps read
// and write the same file.

export interface MapStateJson {
  version: 1
  mapId: string
  nodes: MapStateNode[]
  blocks: MapStateBlock[]
  documents: MapStateDocument[]
  media: MapStateMedia[]
}

export interface MapStateNode {
  id: string
  parentId: string | null
  title: string
  type: string
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export interface MapStateBlock {
  id: string
  nodeId: string
  type: string
  orderIndex: number
  textContent: string | null
  mediaId: string | null
  createdAt: string
}

export interface MapStateDocument {
  id: string
  nodeId: string
  title: string
  content: string
  source: string
  wordCount: number
  createdAt: string
  updatedAt: string
}

export interface MapStateMedia {
  id: string
  nodeId: string
  type: string
  originalFilename: string
  canvasX: number | null
  canvasY: number | null
  createdAt: string
  driveFileId: string | null
}

// ---------- app-level types (PWA-only, not part of the wire format) ----------

export interface DriveMapFolder {
  driveFolderId: string
  title: string
}

export interface GoogleAccountInfo {
  connected: boolean
  email: string | null
}
