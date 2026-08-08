import { useStore } from './store'
import { OfflineBanner } from './components/OfflineBanner'
import { AppNav } from './components/AppNav'
import { InboxScreen } from './screens/InboxScreen'
import { LoginScreen } from './screens/LoginScreen'
import { MapsListScreen } from './screens/MapsListScreen'
import { MapDetailScreen } from './screens/MapDetailScreen'

export function App(): React.JSX.Element {
  const tab = useStore((s) => s.tab)
  const screen = useStore((s) => s.screen)

  return (
    <div className="app-shell">
      <OfflineBanner />
      <div className="app-content">
        {tab === 'inbox' && <InboxScreen />}
        {tab === 'mapas' && screen === 'login' && <LoginScreen />}
        {tab === 'mapas' && screen === 'maps-list' && <MapsListScreen />}
        {tab === 'mapas' && screen === 'map-detail' && <MapDetailScreen />}
      </div>
      <AppNav />
    </div>
  )
}
