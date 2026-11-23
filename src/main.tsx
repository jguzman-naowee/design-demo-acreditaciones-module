import './boot';
import '../mf/src/index.scss';

import { Session } from '@naowee-tech/sdk-frontend-web';
import { createRoot } from 'react-dom/client';

import { AccreditationsApp } from '../mf/src/accreditations/presentation/AccreditationsApp';

const base = (window as unknown as { __BASE__: string }).__BASE__;

// Sesión de mentira con todos los permisos, como la del arnés e2e del micro.
const session = new Session('demo-user', 'Demo Naowee', 'demo@naowee.com', 'INDIVIDUAL', ['ROOT'] as never, ['all:all']);

// Puente con el menú del marco (assets/shell.js): el micro lo llena al montarse.
const host = {
  navigate: undefined as ((p: string) => void) | undefined,
  onNavigate: () => window.dispatchEvent(new Event('acred-ruta')),
  onEventChange: undefined as unknown
};
(window as unknown as { __ACRED_HOST__: typeof host }).__ACRED_HOST__ = host;

createRoot(document.getElementById('root')!).render(
  <AccreditationsApp basename={base || '/'} session={session} host={host as never} />
);
