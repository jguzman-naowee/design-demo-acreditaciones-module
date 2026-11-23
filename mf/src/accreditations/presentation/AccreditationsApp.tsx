import { setCurrentUser } from '@mf-accreditations/data';
import {
  ActiveEventProvider,
  NwsMockNotice
} from '@mf-accreditations/presentation';
import { SessionContext } from '@naowee-tech/sdk-frontend-react';
import type { Session } from '@naowee-tech/sdk-frontend-web';
import { NwtApplication } from '@naowee-tech/sdk-react-components';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AccessControlPage } from '../../validation/presentation/pages/access-control/AccessControlPage';
import { AccessDetailPage } from '../../validation/presentation/pages/access-control/AccessDetailPage';
import { AccessValidatePage } from '../../validation/presentation/pages/access-control/AccessValidatePage';
import { type AccreditationsHost, HostBridge } from './HostBridge';
import { AccessPermissionsPage } from './pages/access-permissions/AccessPermissionsPage';
import { AccreditedTypesPage } from './pages/accredited-types/AccreditedTypesPage';
import { EventAuditPage } from './pages/audit/EventAuditPage';
import { CertificateConfigPage } from './pages/certificates/CertificateConfigPage';
import { CertificatesPage } from './pages/certificates/CertificatesPage';
import { AccreditationMovementsPage } from './pages/delivery/AccreditationMovementsPage';
import { AccreditationProfilePage } from './pages/delivery/AccreditationProfilePage';
import { AccreditedDetailPage } from './pages/delivery/AccreditedDetailPage';
import { AccreditedListPage } from './pages/delivery/AccreditedListPage';
import { BatchDetailPage } from './pages/delivery/BatchDetailPage';
import { CardBatchDetailPage } from './pages/delivery/CardBatchDetailPage';
import { CardBatchesPage } from './pages/delivery/CardBatchesPage';
import { EnabledListPage } from './pages/delivery/EnabledListPage';
import { EventAccreditedDetailPage } from './pages/delivery/EventAccreditedDetailPage';
import { GeneratedBatchesPage } from './pages/delivery/GeneratedBatchesPage';
import { EventEntryPage } from './pages/event-entry/EventEntryPage';

interface AccreditationsAppProps {
  basename?: string;
  // El puente con el anfitrión: opcional a propósito, el módulo funciona sin él. Ver
  // HostBridge.
  host?: AccreditationsHost;
  session?: Session;
}

export function AccreditationsApp({
  basename = '/',
  host,
  session
}: AccreditationsAppProps) {
  // El historial necesita saber quién ejecuta cada acción, y los repositorios no
  // pueden leer el contexto de React. Ver data/config/current-user.ts.
  setCurrentUser(session?.name);

  return session ? (
    <SessionContext value={session}>
      {/* La clase marca nuestro marcado para el CSS, y hoy sirve para una sola cosa:
          darle valor a los tokens tipográficos que el anfitrión usa y no define, sin
          tocarle la tipografía a él. Ver commons/presentation/styles/_host-typography.scss.
          Los modales salen por portal fuera de este árbol y la llevan por su cuenta
          (NwsModal). */}
      <NwtApplication className="nws-accreditations-module">
        {/* Los roles del backend son por evento: la parametrización necesita
            saber en cuál se trabaja, y la selección se comparte entre páginas. */}
        <ActiveEventProvider>
          <BrowserRouter basename={basename}>
            {/* El puente con el anfitrión: le presta el `navigate` del módulo y le avisa
                del evento activo, que es lo que necesita para poner nuestro menú en su
                sidebar. No pinta nada. */}
            <HostBridge host={host} />

            <Routes>
              {/* La entrada del módulo: todo se lee por evento, así que se elige una vez
                  acá y las pantallas que lo necesitan rebotan a esta si falta
                  (NwsEventGuard). Es el único sitio que lee el catálogo de eventos. */}
              <Route path="/" element={<EventEntryPage />} />
              <Route
                path="/parametrization/access-permissions"
                element={<AccessPermissionsPage />}
              />
              <Route
                path="/parametrization/accredited-types"
                element={<AccreditedTypesPage />}
              />
              <Route
                path="/parametrization/certificates"
                element={<CertificateConfigPage />}
              />
              <Route
                path="/delivery/certificates"
                element={<CertificatesPage />}
              />
              {/* Ya NO va envuelta en el aviso de datos de ejemplo: desde el despliegue
                  del 2026-09-01 sale de `ready-for-accreditation` de verdad, con sus dos
                  listas y sus filtros. */}
              <Route path="/delivery/enabled" element={<EnabledListPage />} />
              {/* Las pantallas que siguen contra los mocks viven solo en modo demo.
                  Fuera de él llevan a su hermana conectada, que es la que tiene datos
                  de verdad: un marcador viejo no debería aterrizar en datos falsos sin
                  avisar. Cuando su contrato exista, la pareja se fusiona.
                  ─────────────────────────────────────────────────────────────────────
                  PRÓXIMA A BORRAR (2026-09-03): y ese día no va a llegar. Andrés decidió
                  que las pantallas a las que solo se llega escribiendo la URL no se van a
                  usar, y estas son de ese grupo: fuera del menú y sin nadie que las
                  enlace. Sus componentes están marcados uno por uno y la lista completa
                  está en el README, «Pantallas próximas a borrar». */}
              {/* El detalle del lote se alcanza desde dos lugares; la ruta define
                  el origen para que el sidebar y el breadcrumb sean coherentes. */}
              <Route
                path="/delivery/enabled/batches/:batchId"
                element={
                  <NwsMockNotice instead="Lotes de acreditaciones">
                    <BatchDetailPage origin="enabled" />
                  </NwsMockNotice>
                }
              />
              <Route
                path="/delivery/batches"
                element={
                  <NwsMockNotice instead="Lotes de acreditaciones">
                    <GeneratedBatchesPage />
                  </NwsMockNotice>
                }
              />
              <Route
                path="/delivery/batches/:batchId"
                element={
                  <NwsMockNotice instead="Lotes de acreditaciones">
                    <BatchDetailPage origin="batches" />
                  </NwsMockNotice>
                }
              />
              {/* Los acreditados con carnet, uno por fila y con su lote: es el
                  listado aplanado del módulo, ya con datos reales. */}
              <Route
                path="/delivery/accredited"
                element={<AccreditedListPage />}
              />
              <Route
                path="/delivery/accredited/:accreditationId"
                element={
                  <NwsMockNotice instead="el detalle del acreditado">
                    <AccreditedDetailPage />
                  </NwsMockNotice>
                }
              />
              {/* «Acreditados del evento» se RETIRÓ: la reemplaza «Gestión de acreditables»,
                  que hace lo mismo y además enseña a quién falta por acreditar. Salió del
                  menú de la suite (suite-web-v2#1309) y acá se cierra la otra puerta: la
                  ruta redirige en vez de pintar la pantalla.

                  Redirige y no responde 404 porque el enlace existe fuera de nuestro
                  alcance —marcadores, mensajes, el historial del navegador—, y lo que esa
                  gente busca está en la lista a la que se llega. El detalle de UNA
                  acreditación, que cuelga de esta misma ruta, sigue vivo: es donde caen las
                  dos listas. */}
              <Route
                path="/delivery/event-accredited"
                element={<Navigate to="/delivery/accredited" replace />}
              />
              {/* Los lotes de PDFs que el backend sí tiene. Vive aparte de «Lotes
                  generados», que es el lote de ACREDITACIONES del diseño y de eso
                  no hay contrato: se fusionan con la decisión del lote. */}
              <Route
                path="/delivery/card-batches"
                element={<CardBatchesPage />}
              />
              {/* Qué hay dentro de un lote: sus integrantes y su PDF. */}
              <Route
                path="/delivery/card-batches/:batchCode"
                element={<CardBatchDetailPage />}
              />
              <Route
                path="/delivery/event-accredited/:accreditationCode"
                element={<EventAccreditedDetailPage />}
              />
              {/* Vista transversal: una fila por acreditación con su último
                  movimiento. El historial de una sola vive en su detalle. */}
              <Route
                path="/delivery/history"
                element={
                  <NwsMockNotice instead="el detalle del acreditado">
                    <AccreditationMovementsPage />
                  </NwsMockNotice>
                }
              />
              {/* Control de accesos: el módulo de validación comparte este router
                  para que "Ver perfil público" no recargue la aplicación. */}
              <Route
                path="/validation/access-control"
                element={<AccessControlPage />}
              />
              <Route
                path="/validation/access-control/:accreditationCode"
                element={<AccessDetailPage />}
              />
              {/* La validación real: el QR de la acreditación consumiendo permisos. Vive
                  aparte de «Control de accesos» porque esa lista una fila por
                  acreditación con sus validaciones, y el backend registra LECTURAS. */}
              <Route
                path="/validation/validate"
                element={<AccessValidatePage />}
              />
              {/* Vista de credencial sin el marco de la aplicación: el shell
                  oculta sidebar y toolbar para esta ruta. */}
              {/* La credencial con datos reales. Va antes que la de demo porque
                  comparten prefijo, y el segmento estático manda. */}
              <Route
                path="/profile/event/:accreditationCode"
                element={<AccreditationProfilePage />}
              />
              {/* PRÓXIMA A BORRAR (2026-09-03): la MISMA pantalla que la de arriba, con otro
                  nombre de parámetro. Es la ruta vieja de la credencial de demo y nada la
                  enlaza: la credencial se abre siempre por `/profile/event/:code`. Ver el
                  README, «Pantallas próximas a borrar». */}
              <Route
                path="/profile/:accreditationId"
                element={<AccreditationProfilePage />}
              />
              {/* Una ruta que no existe va a la entrada, no a una pantalla que
                  pediría datos de un evento que quizá no está elegido. */}
              {/* La auditoría cuelga de la RAÍZ del módulo y no de entrega ni de validación:
                  audita el evento entero, no una de sus fases. */}
              <Route path="/audit" element={<EventAuditPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ActiveEventProvider>
      </NwtApplication>
    </SessionContext>
  ) : (
    <></>
  );
}
