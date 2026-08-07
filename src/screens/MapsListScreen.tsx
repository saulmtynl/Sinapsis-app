import { useEffect } from 'react'
import { useStore } from '../store'

export function MapsListScreen(): React.JSX.Element {
  const maps = useStore((s) => s.maps)
  const loading = useStore((s) => s.mapsLoading)
  const error = useStore((s) => s.mapsError)
  const account = useStore((s) => s.account)
  const loadMaps = useStore((s) => s.loadMaps)
  const openMap = useStore((s) => s.openMap)
  const signOut = useStore((s) => s.signOut)

  useEffect(() => {
    void loadMaps()
  }, [loadMaps])

  return (
    <div className="screen maps-list-screen">
      <header className="screen-header">
        <h1>Sinapsis</h1>
        <div className="account-row">
          <span className="text-muted">{account.email}</span>
          <button type="button" className="btn-ghost" onClick={signOut}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {loading && <p className="text-muted">Cargando mapas…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && maps.length === 0 && (
        <p className="text-muted">
          No hay mapas en tu carpeta "Sinapsis" de Drive todavía. Sube uno desde la app de escritorio primero.
        </p>
      )}

      <ul className="maps-list">
        {maps.map((map) => (
          <li key={map.driveFolderId}>
            <button type="button" className="map-list-item" onClick={() => void openMap(map)}>
              {map.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
