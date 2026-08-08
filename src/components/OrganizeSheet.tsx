import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useInboxStore } from '../inboxStore'
import { NodeTree } from './NodeTree'
import { extensionForMimeType } from '../hooks/useMediaRecorder'
import type { InboxItem } from '../types'

interface OrganizeSheetProps {
  item: InboxItem
  onClose: () => void
  onOrganized: () => void
}

const CHILD_TYPE_LABELS: Record<string, string> = {
  exponente: 'Exponente',
  subtema: 'Subtema'
}

function extensionForItem(item: InboxItem): string {
  if (item.kind === 'image') {
    if (item.mimeType?.includes('png')) return 'png'
    if (item.mimeType?.includes('webp')) return 'webp'
    return 'jpg'
  }
  return extensionForMimeType(item.mimeType ?? 'audio/webm')
}

export function OrganizeSheet({ item, onClose, onOrganized }: OrganizeSheetProps): React.JSX.Element {
  const account = useStore((s) => s.account)
  const authError = useStore((s) => s.authError)
  const signIn = useStore((s) => s.signIn)

  const maps = useStore((s) => s.maps)
  const mapsLoading = useStore((s) => s.mapsLoading)
  const mapsError = useStore((s) => s.mapsError)
  const loadMaps = useStore((s) => s.loadMaps)

  const currentMap = useStore((s) => s.currentMap)
  const mapLoading = useStore((s) => s.mapLoading)
  const mapError = useStore((s) => s.mapError)
  const dirty = useStore((s) => s.dirty)
  const saving = useStore((s) => s.saving)
  const saveError = useStore((s) => s.saveError)
  const remoteChangedWarning = useStore((s) => s.remoteChangedWarning)
  const openMap = useStore((s) => s.openMap)
  const addNode = useStore((s) => s.addNode)
  const addTextBlock = useStore((s) => s.addTextBlock)
  const addMediaBlock = useStore((s) => s.addMediaBlock)
  const saveMap = useStore((s) => s.saveMap)
  const discardAndReload = useStore((s) => s.discardAndReload)

  const removeItem = useInboxStore((s) => s.removeItem)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [newNodeTitle, setNewNodeTitle] = useState('')
  const [newNodeType, setNewNodeType] = useState<'exponente' | 'subtema'>('exponente')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  // True once the block/node has been added to currentMap locally, so the
  // "asignar" button turns into a resave rather than a re-add — matters for
  // the remoteChangedWarning conflict path, where saveMap() can be retried
  // (force) without recreating the block a second time.
  const [contentAttached, setContentAttached] = useState(false)

  useEffect(() => {
    if (account.connected && maps.length === 0 && !mapsLoading && !mapsError) void loadMaps()
  }, [account.connected, maps.length, mapsLoading, mapsError, loadMaps])

  // Completes the flow once a save actually goes through: dirty clears only
  // on a successful saveMap() (see store.ts), never on error or while a
  // conflict is still unresolved.
  useEffect(() => {
    if (!contentAttached || dirty || saving || saveError) return
    setContentAttached(false)
    void removeItem(item.id).then(onOrganized)
  }, [contentAttached, dirty, saving, saveError, removeItem, item.id, onOrganized])

  async function handlePickMap(map: { driveFolderId: string; title: string }): Promise<void> {
    if (dirty && !confirm('Tenés cambios sin guardar en otro mapa. ¿Descartarlos para seguir organizando?')) return
    setSelectedNodeId(null)
    await openMap(map)
  }

  function handleAddChildNode(): void {
    if (!selectedNodeId || !newNodeTitle.trim()) return
    const id = addNode(selectedNodeId, newNodeTitle.trim(), newNodeType)
    if (id) {
      setSelectedNodeId(id)
      setNewNodeTitle('')
    }
  }

  async function handleAssign(): Promise<void> {
    if (!selectedNodeId || contentAttached) return
    setAssigning(true)
    setAssignError(null)
    try {
      if (item.kind === 'text') {
        addTextBlock(selectedNodeId, item.textContent ?? '')
      } else {
        if (!item.blob) throw new Error('Este ítem no tiene contenido para asignar.')
        await addMediaBlock(selectedNodeId, item.kind, item.blob, extensionForItem(item))
      }
      setContentAttached(true)
      await saveMap()
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : String(err))
    } finally {
      setAssigning(false)
    }
  }

  // "Descartar y recargar" throws away the local edit (including the block
  // we just attached) and re-downloads state.json — so the flow must not
  // treat that as success, and a retry needs to re-attach the content.
  async function handleDiscardConflict(): Promise<void> {
    setContentAttached(false)
    setSelectedNodeId(null)
    await discardAndReload()
  }

  return (
    <div className="organize-overlay">
      <div className="organize-sheet">
        <header className="screen-header">
          <h2>Organizar</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </header>

        {!account.connected && (
          <div className="organize-step">
            <p className="text-muted">Para asignar este ítem a un nodo necesitás conectar tu cuenta de Google.</p>
            <button type="button" className="btn-primary" onClick={() => void signIn()}>
              Conectar con Google
            </button>
            {authError && <p className="error-text">{authError}</p>}
          </div>
        )}

        {account.connected && !currentMap && (
          <div className="organize-step">
            <p className="text-muted">Elegí en qué mapa va este ítem:</p>
            {mapsLoading && <p className="text-muted">Cargando mapas…</p>}
            {mapsError && <p className="error-text">{mapsError}</p>}
            <ul className="maps-list">
              {maps.map((map) => (
                <li key={map.driveFolderId}>
                  <button type="button" className="map-list-item" disabled={mapLoading} onClick={() => void handlePickMap(map)}>
                    {map.title}
                  </button>
                </li>
              ))}
            </ul>
            {mapLoading && <p className="text-muted">Abriendo mapa…</p>}
            {mapError && <p className="error-text">{mapError}</p>}
          </div>
        )}

        {account.connected && currentMap && (
          <div className="organize-step">
            <div className="organize-step-header">
              <p className="text-muted">Elegí el nodo, o creá uno nuevo debajo de otro:</p>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  useStore.setState({ currentMap: null })
                  setSelectedNodeId(null)
                }}
              >
                ‹ Otro mapa
              </button>
            </div>

            <NodeTree
              nodes={currentMap.state.nodes}
              parentId={null}
              selectedId={selectedNodeId}
              onSelect={setSelectedNodeId}
            />

            {selectedNodeId && (
              <p className="text-muted organize-selected-node">
                Nodo elegido: <strong>{currentMap.state.nodes.find((n) => n.id === selectedNodeId)?.title || '(sin título)'}</strong>
              </p>
            )}

            <div className="organize-new-node">
              <input
                type="text"
                placeholder={selectedNodeId ? 'Título del nuevo nodo hijo…' : 'Elegí primero un nodo padre'}
                value={newNodeTitle}
                onChange={(e) => setNewNodeTitle(e.target.value)}
                disabled={!selectedNodeId}
              />
              <select
                value={newNodeType}
                onChange={(e) => setNewNodeType(e.target.value as 'exponente' | 'subtema')}
                disabled={!selectedNodeId}
              >
                {Object.entries(CHILD_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-ghost" disabled={!selectedNodeId || !newNodeTitle.trim()} onClick={handleAddChildNode}>
                + Crear
              </button>
            </div>

            {remoteChangedWarning ? (
              <div className="conflict-box">
                <p className="warning-text">
                  Este mapa cambió en Drive desde que lo abriste. Elegí qué hacer antes de seguir.
                </p>
                <div className="conflict-actions">
                  <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveMap({ force: true })}>
                    Sobrescribir Drive
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => void handleDiscardConflict()}>
                    Descartar y recargar
                  </button>
                </div>
              </div>
            ) : contentAttached ? (
              <button type="button" className="btn-primary organize-confirm" disabled={saving} onClick={() => void saveMap()}>
                {saving ? 'Guardando…' : 'Reintentar guardado'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary organize-confirm"
                disabled={!selectedNodeId || assigning}
                onClick={() => void handleAssign()}
              >
                {assigning ? 'Asignando…' : 'Asignar acá'}
              </button>
            )}
            {(assignError || saveError) && <p className="error-text">{assignError ?? saveError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
