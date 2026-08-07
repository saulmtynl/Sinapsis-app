import { useStore } from '../store'

export function LoginScreen(): React.JSX.Element {
  const signIn = useStore((s) => s.signIn)
  const authError = useStore((s) => s.authError)

  return (
    <div className="screen login-screen">
      <div className="login-card">
        <h1>Sinapsis</h1>
        <p className="text-muted">Conecta tu cuenta de Google para ver tus mapas guardados en la nube.</p>
        <button type="button" className="btn-primary" onClick={() => void signIn()}>
          Conectar con Google
        </button>
        {authError && <p className="error-text">{authError}</p>}
      </div>
    </div>
  )
}
