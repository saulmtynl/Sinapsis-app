import { useState } from 'react'
import { useStore } from '../store'
import { NodeTree } from '../components/NodeTree'

// Read-only first pass: renders the tree and, for the selected node, its
// blocks/documents from the already-downloaded state.json. Editing,
// recording, and the save/conflict flow (Milestone 9 spec §3-4) come next —
// this screen exists so the Drive read path (auth → list → download →
// render) is provable end to end before layering writes on top.
export function MapDetailScreen(): React.JSX.Element {
  const currentMap = useStore((s) => s.currentMap)
  const remoteChangedWarning = useStore((s) => s.remoteChangedWarning)
  const backToList = useStore((s) => s.backToList)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!currentMap) {
    return (
      <div className="screen map-detail-screen">
        <p className="error-text">No hay ningún mapa cargado.</p>
        <button type="button" className="btn-ghost" onClick={backToList}>
          ← Volver
        </button>
      </div>
    )
  }

  const { state } = currentMap
  const selectedNode = state.nodes.find((n) => n.id === selectedId) ?? null
  const selectedBlocks = state.blocks
    .filter((b) => b.nodeId === selectedId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
  const selectedDocuments = state.documents.filter((d) => d.nodeId === selectedId)

  return (
    <div className="screen map-detail-screen">
      <header className="screen-header">
        <button type="button" className="btn-ghost" onClick={backToList}>
          ← Mapas
        </button>
        <h1>{state.nodes.find((n) => n.parentId === null)?.title ?? 'Mapa'}</h1>
      </header>

      {remoteChangedWarning && (
        <p className="warning-text">
          Este mapa cambió en Drive desde que lo abriste (probablemente desde otro dispositivo). Vuelve a
          entrar antes de guardar para no perder esos cambios.
        </p>
      )}

      <NodeTree nodes={state.nodes} parentId={null} selectedId={selectedId} onSelect={setSelectedId} />

      {selectedNode && (
        <section className="node-detail-panel">
          <h2>{selectedNode.title}</h2>

          {selectedBlocks.length === 0 && selectedDocuments.length === 0 && (
            <p className="text-muted">Este nodo todavía no tiene bloques ni documentos.</p>
          )}

          {selectedBlocks.length > 0 && (
            <ul className="block-list">
              {selectedBlocks.map((block) => (
                <li key={block.id} className={`block-item block-type-${block.type}`}>
                  {block.textContent ?? `[${block.type}]`}
                </li>
              ))}
            </ul>
          )}

          {selectedDocuments.length > 0 && (
            <div className="document-list">
              {selectedDocuments.map((doc) => (
                <article key={doc.id} className="document-item">
                  <h3>{doc.title}</h3>
                  <p className="text-muted">{doc.wordCount} palabras</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
