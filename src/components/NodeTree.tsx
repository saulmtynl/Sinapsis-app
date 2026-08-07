import { useState } from 'react'
import type { MapStateNode } from '../types'

interface NodeTreeProps {
  nodes: MapStateNode[]
  parentId: string | null
  selectedId: string | null
  onSelect: (id: string) => void
  depth?: number
}

// First-pass mobile tree: expandable indented list, no drag-and-drop and no
// canvas — the visual dnd-kit editor from desktop is explicitly out of
// scope for the PWA (Milestone 9 spec §6). Open question for the user per
// the milestone brief: whether this list view is the right final shape for
// small screens, or whether something like collapsible cards reads better —
// flagged, not yet decided.
export function NodeTree({ nodes, parentId, selectedId, onSelect, depth = 0 }: NodeTreeProps): React.JSX.Element {
  const children = nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex)

  return (
    <ul className="node-tree" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      {children.map((node) => (
        <TreeItem key={node.id} node={node} nodes={nodes} selectedId={selectedId} onSelect={onSelect} depth={depth} />
      ))}
    </ul>
  )
}

function TreeItem({
  node,
  nodes,
  selectedId,
  onSelect,
  depth
}: {
  node: MapStateNode
  nodes: MapStateNode[]
  selectedId: string | null
  onSelect: (id: string) => void
  depth: number
}): React.JSX.Element {
  const hasChildren = nodes.some((n) => n.parentId === node.id)
  const [expanded, setExpanded] = useState(depth < 1)

  return (
    <li>
      <div className={`node-row type-${node.type}`} data-selected={node.id === selectedId}>
        {hasChildren ? (
          <button
            type="button"
            className="node-expand-toggle"
            aria-label={expanded ? 'Contraer' : 'Expandir'}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="node-expand-spacer" />
        )}
        <button type="button" className="node-title-button" onClick={() => onSelect(node.id)}>
          {node.title || '(sin título)'}
        </button>
      </div>
      {hasChildren && expanded && (
        <NodeTree nodes={nodes} parentId={node.id} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
      )}
    </li>
  )
}
