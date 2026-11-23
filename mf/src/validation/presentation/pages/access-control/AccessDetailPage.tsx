// ═══════════════════════════════════════════════════════════════════════════════
// PRÓXIMA A BORRAR — decisión de producto, 2026-09-03
//
// A esta pantalla solo se llega escribiendo su URL: no está en el menú y nada del
// módulo la enlaza. Andrés decidió que las que están así no se van a usar.
//
// Se marca en vez de borrarse ya para que la eliminación sea un cambio propio y
// revisable, no un arrastre. La lista completa está en el README, sección
// «Pantallas próximas a borrar».
//
// Qué es: el detalle de «Control de accesos». Solo se alcanza desde esa pantalla, que
// también está marcada.
// ═══════════════════════════════════════════════════════════════════════════════

import './AccessControlPages.scss';

import {
  AccreditationPersonRepository,
  AccreditedRecordRepository,
  SEX_LABELS
} from '@mf-accreditations/data';
import type {
  AccreditationPerson,
  AccreditedRecordDetail
} from '@mf-accreditations/domain';
import {
  getCatalogStatusLabel,
  getCatalogStatusTheme,
  NwsDetailField,
  NwsLoading,
  NwsRequestError
} from '@mf-accreditations/presentation';
import type { NwtTabItem } from '@naowee-tech/sdk-react-components';
import {
  NwtBadge,
  NwtBreadcrumb,
  NwtCard,
  NwtDivider,
  NwtTabs
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AccessValidationHistory } from './AccessValidationHistory';

const repository = invertly(AccreditedRecordRepository);
const personRepository = invertly(AccreditationPersonRepository);

// Lo que el diseño pide y el contrato no da. Se pinta la raya en lugar de esconder el campo:
// así la pantalla se ve igual al diseño y se ve qué falta pedirle al backend.
const SIN_DATO = '—';

const LIST_ROUTE = '/validation/access-control';

type DetailTab = 'data' | 'history';

const TABS: NwtTabItem<DetailTab>[] = [
  { id: 'data', label: 'Datos', value: 'data' },
  { id: 'history', label: 'Historial', value: 'history' }
];

export function AccessDetailPage() {
  const navigate = useNavigate();
  const { accreditationCode } = useParams();

  const [tab, setTab] = useState<DetailTab>('data');
  const [detail, setDetail] = useState<AccreditedRecordDetail>();
  const [person, setPerson] = useState<AccreditationPerson>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);

  // El mismo par que el detalle de entrega: la acreditación trae el nombre aplanado en
  // `full_name`, y los nombres por separado que este diseño pide solo están en /persons.
  const load = useCallback(() => {
    if (!accreditationCode) {
      return;
    }

    setLoading(true);
    setError(undefined);

    repository
      .requestDetail(accreditationCode)
      .then((record) => {
        setDetail(record);

        // Si /persons no encuentra a la persona, el detalle sigue sirviendo con el nombre
        // completo de la acreditación.
        return personRepository
          .findByDocument(record.document)
          .then(setPerson)
          .catch(() => undefined);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [accreditationCode]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <section className="nws-access-control">
        <div className="nws-access-control__content">
          <NwsLoading>
            <h4>Cargando acreditado, por favor espere...</h4>
          </NwsLoading>
        </div>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="nws-access-control">
        <div className="nws-access-control__content">
          <NwsRequestError
            error={error}
            title="No pudimos cargar el acreditado"
            onRetry={load}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="nws-access-control">
      <div className="nws-access-control__content">
        {/* El mockup lo pinta en la barra superior, que es del shell: llevarlo
            allí obliga a abrir un canal shell↔remote que hoy no existe. */}
        <NwtBreadcrumb
          items={[
            { key: 'back', label: 'Lista de accesos' },
            {
              key: 'detail',
              label: detail.document,
              active: true
            }
          ]}
          onBreadcrumb={(item) => item.key === 'back' && navigate(LIST_ROUTE)}
        />

        <div className="nws-access-control__header">
          <div className="nws-access-control__description">
            <span className="nwt-h5-font-bold">Detalle del acreditado</span>
          </div>
        </div>

        <NwtCard
          className="nws-access-control__card"
          header={
            <NwtTabs<DetailTab> items={TABS} value={tab} onChange={setTab} />
          }
        >
          {tab === 'data' ? (
            <div className="nws-access-control__panel">
              <header className="nws-access-control__section">
                <span className="nwt-subtitle-font-bold">
                  Información básica
                </span>

                <NwtBadge
                  nwtVariant="quiet"
                  nwtTheme={getCatalogStatusTheme(detail.status)}
                  vignette={true}
                >
                  {getCatalogStatusLabel(detail.status)}
                </NwtBadge>
              </header>

              <div className="naotech-grid naotech-grid--4">
                <div className="naotech-col--2">
                  <NwsDetailField label="Nombre">
                    {person?.firstName || detail.fullName}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Segundo nombre">
                    {person?.secondName || SIN_DATO}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Apellido">
                    {person?.lastName || SIN_DATO}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  <NwsDetailField label="Segundo apellido">
                    {person?.secondLastName || SIN_DATO}
                  </NwsDetailField>
                </div>

                <div className="naotech-col--2">
                  {/* El sexo lo llena el backend desde user-auth al CREAR la persona, así
                      que las anteriores a ese despliegue llegan sin él. */}
                  <NwsDetailField label="Sexo">
                    {person?.sex
                      ? (SEX_LABELS[person.sex] ?? person.sex)
                      : SIN_DATO}
                  </NwsDetailField>
                </div>
              </div>

              <NwtDivider />

              <span className="nwt-subtitle-font-bold">
                Información de acreditación
              </span>

              <div className="naotech-grid naotech-grid--4">
                <div className="naotech-col--2">
                  <NwsDetailField label="Tipo de acreditado">
                    {detail.roleName}
                  </NwsDetailField>
                </div>
              </div>
            </div>
          ) : (
            <AccessValidationHistory detail={detail} />
          )}
        </NwtCard>
      </div>
    </section>
  );
}
