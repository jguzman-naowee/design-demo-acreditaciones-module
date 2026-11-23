import './AccreditationProfilePage.scss';

import {
  AccreditationRepository,
  AccreditedRecordRepository,
  PROFILE_SPORT_INFO
} from '@mf-accreditations/data';
import type { AccreditedRecordDetail } from '@mf-accreditations/domain';
import {
  getCatalogStatusLabel,
  getCatalogStatusTheme,
  NwsDetailField,
  NwsFileThumbnail,
  NwsLoading
} from '@mf-accreditations/presentation';
import { useRepository } from '@naowee-tech/sdk-frontend-react';
import { getInitials } from '@naowee-tech/sdk-frontend-web';
import {
  NwtAvatar,
  NwtBadge,
  NwtButton,
  NwtCard,
  NwtDivider,
  NwtEmptyState,
  NwtTextLink
} from '@naowee-tech/sdk-react-components';
import { invertly } from '@rolster/invertly';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import emptyCatalogUrl from '../EmptyCatalog.svg';

const illustrationUrl = new URL(emptyCatalogUrl, import.meta.url).href;

const repository = invertly(AccreditationRepository);
const recordRepository = invertly(AccreditedRecordRepository);

const LIST_ROUTE = '/delivery/accredited';

// Lo que la credencial necesita pintar, venga del contrato o del mock. Tenerlo en un
// solo sitio evita dos tarjetas que se desincronizan.
interface CredentialView {
  category: string;
  certificateUrl?: string | null;
  delegation: string;
  disciplines: string;
  fullName: string;
  permissions: {
    iconUploadId: string | null;
    id: number;
    name: string;
    place: string;
    usesLabel: string;
  }[];
  photoUrl?: string | null;
  roleName: string;
  sport: string;
  sportsError?: string | null;
  statusCode: string;
  userType?: string;
}

export function AccreditationProfilePage() {
  const controller = useRepository(repository);
  const navigate = useNavigate();
  // Dos rutas, una pantalla: `/profile/event/:code` lee el detalle real y
  // `/profile/:id` sirve el camino de demo mientras la sección conviva con sus
  // pantallas en mock.
  //
  // Se distingue por la RUTA y no por la forma del id: el mock crea acreditaciones
  // con crypto.randomUUID(), así que adivinar «uuid = real» mandaba las recién
  // creadas del mock a pedir un detalle que no existe.
  const { accreditationCode, accreditationId } = useParams();

  const real = !!accreditationCode;

  const [detail, setDetail] = useState<AccreditedRecordDetail>();
  const [loadingDetail, setLoadingDetail] = useState(real);

  useEffect(() => {
    if (!accreditationCode) {
      return;
    }

    setLoadingDetail(true);

    recordRepository
      .requestDetail(accreditationCode)
      .then(setDetail)
      .catch(() => setDetail(undefined))
      .finally(() => setLoadingDetail(false));

    // Ya no se baja el catálogo de permisos para cruzar el icono: el detalle lo trae en
    // cada permiso. Medido en staging el 2026-09-08, 156 de 156 en tres eventos.
  }, [accreditationCode]);

  const accreditation = useMemo(() => {
    return controller.state.is('success')
      ? controller.state.entities.find(
          (item) => String(item.id) === accreditationId
        )
      : undefined;
  }, [controller.state, accreditationId]);

  const view = useMemo<CredentialView | undefined>(() => {
    if (real) {
      if (!detail) {
        return undefined;
      }

      return {
        fullName: detail.fullName,
        roleName: detail.roleName,
        // Llega vacía mientras las personas de dev no tengan departamento.
        delegation: detail.departmentName || 'Sin delegación',
        statusCode: detail.statusCode,
        photoUrl: detail.photoUrl,
        sport: detail.sportsInfo?.sportName || '',
        category: detail.sportsInfo?.categoryName || '',
        disciplines: detail.sportsInfo?.disciplines.join(', ') || '',
        sportsError: detail.sportsInfoError,
        certificateUrl: detail.certificateUrl,
        permissions: detail.permissions.map((permission) => ({
          id: permission.permissionId,
          name: permission.permissionName,
          usesLabel: permission.usesLabel
            ? `${permission.usesLabel} usos`
            : 'Sin tope',
          place: permission.place,
          iconUploadId: permission.fileIconUploadId
        }))
      };
    }

    if (!accreditation) {
      return undefined;
    }

    return {
      fullName: accreditation.fullName,
      roleName: accreditation.accreditedType,
      delegation: accreditation.delegation,
      statusCode: accreditation.status,
      userType: accreditation.userType,
      // El camino de demo no tiene de dónde sacar el deporte: es un ejemplo fijo.
      sport: PROFILE_SPORT_INFO.sport,
      category: PROFILE_SPORT_INFO.category,
      disciplines: PROFILE_SPORT_INFO.event,
      permissions: accreditation.permissions.map((permission) => ({
        id: permission.permissionId,
        name: permission.permissionName,
        usesLabel: permission.usesLabel
          ? `${permission.usesLabel} usos`
          : 'Sin tope',
        place: permission.place,
        iconUploadId: permission.fileIconUploadId
      }))
    };
  }, [real, detail, accreditation]);

  if (loadingDetail || (!real && controller.state.is('loading'))) {
    return (
      <section className="nws-accreditation-profile">
        <NwsLoading>
          <h4>Cargando acreditación, por favor espere...</h4>
        </NwsLoading>
      </section>
    );
  }

  if (!view) {
    return (
      <section className="nws-accreditation-profile">
        <NwtEmptyState
          illustrationUrl={illustrationUrl}
          title="No encontramos la acreditación"
          description={
            real
              ? 'El código de la credencial no corresponde a ninguna acreditación.'
              : 'Es posible que se haya generado en otra sesión.'
          }
          actionLabel="Volver a lista de acreditados"
          showAction={true}
          onActionClick={() => navigate(LIST_ROUTE)}
        />
      </section>
    );
  }

  const hasSportsInfo = !!(view.sport || view.category || view.disciplines);

  return (
    <section className="nws-accreditation-profile">
      {/* La vista no tiene marco: sin este enlace no habría forma de volver. Se
          llega desde varias pantallas, así que vuelve por el historial en vez de a
          una ruta fija.
          Ojo: la credencial que abre el QR del reverso NO es esta. Es la pública de la
          landing (`/acreditacion/{qr_public_token}` en juegosintercolegiados.com.co), que no
          pide sesión. Esta es la vista previa interna, y por eso el enlace de volver sí
          tiene sentido acá. */}
      {/* En su carril y no estirado a lo ancho de la tarjeta: el enlace llevaba el
          `max-width` de 56rem, así que su área pulsable era toda esa franja y un clic al
          lado del texto volvía atrás sin querer. */}
      <div className="nws-accreditation-profile__back-rail">
        <NwtButton
          className="nws-accreditation-profile__back"
          icon="arrow-left"
          nwtVariant="mute"
          nwtSize="small"
          onClick={() => navigate(-1)}
        >
          Volver
        </NwtButton>
      </div>

      <article className="nws-accreditation-profile__card">
        <header className="nws-accreditation-profile__banner">
          <div className="nws-accreditation-profile__photo">
            {/* La foto es una URL prefirmada de vida corta; hoy llega null porque no
                hay foto aprobada en el paquete documental, y se cae a las iniciales. */}
            {view.photoUrl ? (
              <img
                className="nws-accreditation-profile__photo-image"
                src={view.photoUrl}
                alt={`Foto de ${view.fullName}`}
              />
            ) : (
              <NwtAvatar nwtColor="purple" nwtSize="large">
                {getInitials(view.fullName)}
              </NwtAvatar>
            )}

            {/* El tipo de usuario no existe en el contrato real: solo se pinta en el
                camino de demo, donde el mock lo inventa. */}
            {view.userType && (
              <NwtBadge
                className="nws-accreditation-profile__photo-badge"
                nwtTheme="positive"
                nwtSize="small"
                bordered={true}
              >
                {view.userType}
              </NwtBadge>
            )}
          </div>

          <div className="nws-accreditation-profile__identity">
            <span className="nws-accreditation-profile__name nwt-h4-font-bold">
              {view.fullName}
            </span>

            <div className="nws-accreditation-profile__chips">
              <NwtBadge nwtSize="large" nwtVariant="quiet">
                {view.roleName}
              </NwtBadge>

              <NwtBadge nwtSize="large" nwtVariant="quiet" icon="gps-pin">
                {view.delegation}
              </NwtBadge>
            </div>
          </div>
        </header>

        <section className="nws-accreditation-profile__block">
          <span className="nwt-subtitle-font-bold">Información deportiva</span>

          <div className="nws-accreditation-profile__strip">
            <NwsDetailField label="Estado">
              <NwtBadge
                nwtVariant="quiet"
                nwtTheme={getCatalogStatusTheme(
                  view.statusCode === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
                )}
              >
                {getCatalogStatusLabel(
                  view.statusCode === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
                )}
              </NwtBadge>
            </NwsDetailField>

            {/* Los datos deportivos se resuelven en vivo contra el módulo de eventos y
                solo existen para deportistas a título individual: el personal de
                apoyo y los deportes de conjunto no los tienen. Cuando no hay, se dice
                en lugar de pintar campos vacíos. */}
            {hasSportsInfo ? (
              <>
                <NwtDivider
                  className="nws-accreditation-profile__strip-divider"
                  orientation="vertical"
                />

                <NwsDetailField label="Deporte">
                  {view.sport || '—'}
                </NwsDetailField>

                <NwtDivider
                  className="nws-accreditation-profile__strip-divider"
                  orientation="vertical"
                />

                <NwsDetailField label="Categoría">
                  {view.category || '—'}
                </NwsDetailField>

                <NwtDivider
                  className="nws-accreditation-profile__strip-divider"
                  orientation="vertical"
                />

                <NwsDetailField label="Pruebas">
                  {view.disciplines || '—'}
                </NwsDetailField>
              </>
            ) : (
              <>
                {/* SIN separador: solo tiene sentido entre dos campos, y acá lo que sigue es
                    una frase. Con la tira envolviendo en pantalla estrecha, el separador se
                    quedaba colgando al final del primer renglón. */}
                <span className="nwt-smalltext-font-regular">
                  {/* Cuando el servicio de deportes falla, el motivo lo redacta el
                      backend en español y se muestra tal cual. */}
                  {/* Dice POR QUÉ puede faltar: sin eso, quien lo lee cree que su
                      credencial salió incompleta. */}
                  {view.sportsError ??
                    'Esta acreditación no tiene información deportiva: el personal de apoyo y los deportes de conjunto no la llevan.'}
                </span>
              </>
            )}
          </div>
        </section>

        {/* Los permisos que de verdad concede esta acreditación, con el icono que
            cada uno tiene en file-storage, sus usos y —desde el paquete del 13— su
            zona y su sede. Antes eran cinco zonas quemadas, iguales para todas. */}
        {!!view.permissions.length && (
          <section className="nws-accreditation-profile__block">
            <span className="nwt-subtitle-font-bold">Zonas de acceso</span>

            <div className="nws-accreditation-profile__zones">
              {view.permissions.map((permission) => (
                <NwtCard
                  key={permission.id}
                  className="nws-accreditation-profile__zone"
                  nwtVariant="mute"
                  nwtSize="small"
                >
                  <NwsFileThumbnail
                    label={permission.name}
                    uploadId={permission.iconUploadId}
                  />

                  <div className="nws-accreditation-profile__zone-text">
                    <span className="nwt-smalltext-font-medium">
                      {permission.name}
                    </span>

                    <small className="nwt-smalltext-font-regular">
                      {permission.place
                        ? `${permission.place} · ${permission.usesLabel}`
                        : permission.usesLabel}
                    </small>
                  </div>
                </NwtCard>
              ))}
            </div>
          </section>
        )}

        <section className="nws-accreditation-profile__block">
          <span className="nwt-subtitle-font-bold">Descargas</span>

          {/* El enlace se pinta SIEMPRE, y sin URL va apagado con el motivo debajo: un
              enlace que desaparece hace dudar de si el certificado existe.
              Y va con `href` de verdad, no con un `window.open` en el `onClick`: así se puede
              abrir en pestaña nueva, copiar el enlace o pulsarlo con el botón central, que
              con un ancla sin href no funcionaba.
              El backend empezó a emitirlos el 2026-09-07: `certificate_url` viene FIRMADO,
              con diez minutos de vida, y se regenera en cada carga. Por eso se abre en el
              momento y no se guarda en ninguna parte. */}
          {view.certificateUrl ? (
            <NwtTextLink
              className="nws-accreditation-profile__download"
              icon="download"
              href={view.certificateUrl}
              target="_blank"
            >
              Descarga aquí tu certificado de participación
            </NwtTextLink>
          ) : (
            <>
              <NwtTextLink
                className="nws-accreditation-profile__download"
                icon="download"
                disabled={true}
              >
                Descarga aquí tu certificado de participación
              </NwtTextLink>

              {/* El motivo, ahora que los certificados existen: no es que el evento no haya
                  terminado —el backend los emite cuando alguien los genera, y la fecha de
                  entrega es del certificado, no del evento—. Es que a esta persona todavía no
                  se le generó. */}
              <small className="nwt-smalltext-font-regular">
                Todavía no se ha emitido tu certificado. Se genera desde la
                organización del evento.
              </small>
            </>
          )}
        </section>

        {/* TODO(assets): NwtLogoNaowee necesita --naotech-logo-background y en
            este proyecto no hay SVG del logo todavía. */}
        <footer className="nws-accreditation-profile__brand">
          <span className="nwt-caption-font-regular">Powered by</span>
          <span className="nwt-body-font-black">naowee</span>
        </footer>
      </article>
    </section>
  );
}
