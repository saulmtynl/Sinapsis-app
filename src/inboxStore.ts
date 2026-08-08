import { create } from 'zustand'
import * as inboxDb from './lib/inboxDb'
import type { InboxItem, InboxItemKind } from './types'

interface InboxStore {
  items: InboxItem[]
  loading: boolean
  error: string | null

  loadItems: () => Promise<void>
  addTextItem: (text: string) => Promise<void>
  addMediaItem: (kind: InboxItemKind, blob: Blob, mimeType: string) => Promise<void>
  updateItemText: (id: string, text: string) => Promise<void>
  removeItem: (id: string) => Promise<void>
}

function sortByNewestFirst(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const useInboxStore = create<InboxStore>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  loadItems: async () => {
    set({ loading: true, error: null })
    try {
      const items = await inboxDb.getAllInboxItems()
      set({ items: sortByNewestFirst(items), loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  addTextItem: async (text) => {
    const item: InboxItem = {
      id: crypto.randomUUID(),
      kind: 'text',
      textContent: text,
      blob: null,
      mimeType: null,
      transcriptStatus: 'none',
      createdAt: new Date().toISOString()
    }
    await inboxDb.putInboxItem(item)
    set({ items: sortByNewestFirst([...get().items, item]) })
  },

  addMediaItem: async (kind, blob, mimeType) => {
    const item: InboxItem = {
      id: crypto.randomUUID(),
      kind,
      textContent: null,
      blob,
      mimeType,
      transcriptStatus: 'none',
      createdAt: new Date().toISOString()
    }
    await inboxDb.putInboxItem(item)
    set({ items: sortByNewestFirst([...get().items, item]) })
  },

  updateItemText: async (id, text) => {
    const current = get().items.find((i) => i.id === id)
    if (!current) return
    const updated = { ...current, textContent: text }
    await inboxDb.putInboxItem(updated)
    set({ items: get().items.map((i) => (i.id === id ? updated : i)) })
  },

  removeItem: async (id) => {
    await inboxDb.deleteInboxItem(id)
    set({ items: get().items.filter((i) => i.id !== id) })
  }
}))
