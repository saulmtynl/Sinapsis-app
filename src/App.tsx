import { useStore } from './store'
import { OfflineBanner } from './components/OfflineBanner'
import { LoginScreen } from './screens/LoginScreen'
import { MapsListScreen } from './screens/MapsListScreen'
import { MapDetailScreen } from './screens/MapDetailScreen'

export function App(): React.JSX.Element {
  const screen = useStore((s) => s.screen)

  return (
    <div className="app-shell">
      <OfflineBanner />
      {screen === 'login' && <LoginScreen />}
      {screen === 'maps-list' && <MapsListScreen />}
      {screen === 'map-detail' && <MapDetailScreen />}
    </div>
  )
}
