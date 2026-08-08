import { useStore } from '../store'

export function AppNav(): React.JSX.Element {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)

  return (
    <nav className="app-nav">
      <button
        type="button"
        className="app-nav-item"
        data-active={tab === 'inbox'}
        onClick={() => setTab('inbox')}
      >
        📥 Inbox
      </button>
      <button
        type="button"
        className="app-nav-item"
        data-active={tab === 'mapas'}
        onClick={() => setTab('mapas')}
      >
        🗺️ Mapas
      </button>
    </nav>
  )
}
