import './index.scss';

import { API_CONFIG } from '@mf-accreditations/data';
import { NwsLoading } from '@mf-accreditations/presentation';
import {
  NwtSessionGate,
  NwtSessionProvider,
  useAuthCallbackFlow,
  useSessionState
} from '@naowee-tech/sdk-frontend-react';
import {
  configureHttp,
  responseToSession
} from '@naowee-tech/sdk-frontend-web';
import { NwtButton } from '@naowee-tech/sdk-react-components';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import { AccreditationsApp } from './accreditations/presentation/AccreditationsApp';

configureHttp({ sessionHeader: 'X-Session-ID', withCredentials: true });

function AuthCallback() {
  const { status, redirectTo, retry } = useAuthCallbackFlow();

  useEffect(() => {
    if (status === 'authenticated') {
      window.location.replace(redirectTo ?? '/');
    }
  }, [status, redirectTo]);

  if (status === 'unauthenticated') {
    return (
      <main className="nws-auth-callback">
        <h2>Error al iniciar sesión</h2>

        <p>
          La sesión recibida no es válida. Por favor intenta iniciar sesión
          nuevamente.
        </p>

        <NwtButton onClick={retry}>Volver a intentar</NwtButton>
      </main>
    );
  }

  return (
    <NwsLoading>
      <h4>Completando autenticación, por favor espere…</h4>
    </NwsLoading>
  );
}

function AppContent() {
  const { session } = useSessionState();

  return <AccreditationsApp session={session} />;
}

function App() {
  return (
    <NwtSessionProvider config={API_CONFIG} factory={responseToSession}>
      {window.location.pathname === '/auth/callback' ? (
        <AuthCallback />
      ) : (
        <NwtSessionGate
          fallback={
            <NwsLoading>
              <h4>Verificando sesión, por favor espere…</h4>
            </NwsLoading>
          }
        >
          <AppContent />
        </NwtSessionGate>
      )}
    </NwtSessionProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
