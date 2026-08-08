import { useEffect, useState } from 'react'
import { useInboxStore } from '../inboxStore'
import { InboxRecordButton } from '../components/InboxRecordButton'
import { OrganizeSheet } from '../components/OrganizeSheet'
import type { InboxItem } from '../types'

const DATE_FORMAT = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
})

export function InboxScreen(): React.JSX.Element {
  const items = useInboxStore((s) => s.items)
  const loading = useInboxStore((s) => s.loading)
  const error = useInboxStore((s) => s.error)
  const loadItems = useInboxStore((s) => s.loadItems)
  const addTextItem = useInboxStore((s) => s.addTextItem)

  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [organizingItem, setOrganizingItem] = useState<InboxItem | null>(null)
  const [justOrganized, setJustOrganized] = useState(false)

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  async function handleSave(): Promise<void> {
    const text = draft.trim()
    if (!text) return
    setSaving(true)
    try {
      await addTextItem(text)
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  function handleOrganized(): void {
    setOrganizingItem(null)
    setJustOrganized(true)
    setTimeout(() => setJustOrganized(false), 3000)
  }

  return (
    <div className="screen inbox-screen">
      <header className="screen-header">
        <h1>Inbox</h1>
      </header>

      <div className="capture-bar">
        <textarea
          className="capture-textarea"
          placeholder="Anotá una idea…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
        />
        <div className="capture-actions">
          <button type="button" className="btn-primary" disabled={saving || !draft.trim()} onClick={() => void handleSave()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="capture-record">
        <InboxRecordButton />
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="text-muted">Cargando…</p>}
      {justOrganized && <p className="text-muted">Listo, quedó organizado en el mapa. ✓</p>}

      {!loading && items.length === 0 && (
        <p className="text-muted">No hay nada pendiente todavía. Lo que anotes acá se guarda al toque, sin elegir dónde va.</p>
      )}

      <ul className="inbox-list">
        {items.map((item) => (
          <InboxItemRow key={item.id} item={item} onOrganize={() => setOrganizingItem(item)} />
        ))}
      </ul>

      {organizingItem && (
        <OrganizeSheet
          item={organizingItem}
          onClose={() => setOrganizingItem(null)}
          onOrganized={handleOrganized}
        />
      )}
    </div>
  )
}

function InboxItemRow({ item, onOrganize }: { item: InboxItem; onOrganize: () => void }): React.JSX.Element {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!item.blob) return
    const url = URL.createObjectURL(item.blob)
    setMediaUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [item.blob])

  return (
    <li className={`inbox-item inbox-item-${item.kind}`}>
      <div className="inbox-item-content">
        {item.kind === 'text' && <p>{item.textContent}</p>}
        {item.kind === 'audio' && mediaUrl && <audio src={mediaUrl} controls className="block-media-player" />}
        {item.kind === 'image' && mediaUrl && <img src={mediaUrl} alt="" className="block-media-player" />}
      </div>
      <div className="inbox-item-meta">
        <span className="text-muted">{DATE_FORMAT.format(new Date(item.createdAt))}</span>
        <button type="button" className="btn-ghost" onClick={onOrganize}>
          Organizar
        </button>
      </div>
    </li>
  )
}
