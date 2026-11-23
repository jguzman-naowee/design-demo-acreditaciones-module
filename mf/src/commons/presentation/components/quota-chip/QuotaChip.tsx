import './QuotaChip.scss';

import { NwtBadge } from '@naowee-tech/sdk-react-components';

// El cupo de un tipo de acreditado: cuántos autorizó el módulo de Cupos y cuántos se llevan
// emitidos contra ese cupo.
export interface NwsQuota {
  assigned: number;
  consumed: number;
}

interface NwsQuotaChipProps {
  quota?: NwsQuota;
}

// A partir de acá conviene avisar aunque todavía quepa gente: acreditar es el primer escalón de
// una escalera que termina en un carnet impreso, y quien coordina necesita margen para pedir
// ampliación ANTES de quedarse sin ninguno.
const MARGEN_DE_AVISO = 0.2;

// El cupo del tipo, en la fila.
//
// TODO(api): NO hay de dónde sacarlo. El cupo vive en otro módulo de la suite y los dos no se
// hablan: `GET /roles` no trae ni el asignado ni el consumido, así que hoy todas las filas van
// en raya. Pedido a Javi: `assigned_quota` y `consumed_quota` por evento y tipo.
//
// Se deja construido y no comentado porque el día que llegue el dato solo hay que pasárselo:
// las tres situaciones que el diseño distingue —normal, agotado y excedido— ya están acá.
export function NwsQuotaChip({ quota }: NwsQuotaChipProps) {
  if (!quota) {
    return <span className="nws-quota-chip__empty">—</span>;
  }

  const { assigned, consumed } = quota;
  const restantes = Math.max(0, assigned - consumed);

  // Agotado y excedido no son lo mismo, y por eso se dicen distinto: agotado significa «no cabe
  // nadie más», que es una situación normal, y excedido significa «ya se pasó», que es un hecho
  // consumado con carnets impresos de por medio. Quien lo lee tiene que saber si el problema ya
  // ocurrió o está por ocurrir.
  const excedido = consumed > assigned;
  const agotado = restantes === 0;
  const justo =
    !agotado && restantes <= Math.max(1, assigned * MARGEN_DE_AVISO);

  const conteo = `${consumed} de ${assigned}`;

  return (
    <span className="nws-quota-chip">
      <NwtBadge
        nwtVariant="quiet"
        nwtTheme={agotado ? 'negative' : justo ? 'caution' : 'neutral'}
      >
        {excedido
          ? `Excedido · ${conteo}`
          : agotado
            ? `Agotado · ${conteo}`
            : conteo}
      </NwtBadge>
    </span>
  );
}
