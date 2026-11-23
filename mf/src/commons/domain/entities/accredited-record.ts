import { Entity } from '@naowee-tech/sdk-frontend-web';

import type { CatalogStatus } from '../types/status.type';
import type { AccreditationPermission } from './accreditation';

// La categoría del personal de apoyo, tal como la manda el backend en `platform_role`. La
// usan el detalle y el modal de cambio de tipo: una sola definición para las dos.
export const SUPPORT_PERSONNEL = 'SUPPORT_PERSONNEL';

// Una acreditación tal como la devuelve el gateway. Es una entidad aparte de
// `Accreditation` a propósito: esa exige veinte campos y el contrato real da nueve,
// así que reusarla obligaría a inventar lote, tipo de documento, delegación y el id
// de validación. Cuando el backend tenga esos campos, las dos se fusionan.
export class AccreditedRecord extends Entity {
  constructor(
    // El id es el `code` (uuid) que usan los carnets y el detalle.
    id: string,
    public readonly eventId: number,
    public readonly document: string,
    // Aplanado por el backend; los nombres separados están en /persons.
    public readonly fullName: string,
    public readonly roleCode: string,
    public readonly roleName: string,
    // El valor crudo, para no perder un estado nuevo que todavía no mapeamos.
    public readonly statusCode: string,
    public readonly permissionsTotal: number,
    public readonly usesConsumed: number,
    public readonly createdAt: Date,
    // La delegación de la persona. Hoy llega vacía —las personas de dev son
    // anteriores al campo y el backfill está pendiente— pero el contrato ya la
    // declara, así que se muestra en cuanto exista.
    public readonly departmentName = '',
    // La entrega es un eje aparte del estado: una acreditación entregada sigue
    // ACTIVE. Por eso no se mezclan en un solo badge.
    //
    // Son DOS campos porque el contrato los reparte: el listado manda
    // `delivery_status` y el detalle manda `delivered_at`. Ninguno de los dos está
    // en las dos respuestas.
    public readonly deliveredAt: Date | null = null,
    public readonly deliveredByCode: string | null = null,
    public readonly deliveryStatus: string | null = null,
    // Cuándo se imprimió, que es un eje distinto de entregarlo: el carnet se imprime antes
    // de que la persona pase a recogerlo.
    public readonly printedAt: Date | null = null
  ) {
    super(id);
  }

  // Cualquiera de los dos caminos vale, porque cada respuesta trae solo uno. Mirar
  // únicamente la fecha dejaba el listado entero en «Sin entregar».
  public get delivered(): boolean {
    return this.deliveryStatus === 'DELIVERED' || !!this.deliveredAt;
  }

  // Impresa pero todavía en el mostrador. Es la situación que el rediseño pedía y que no se
  // podía pintar: se sabe que el carnet existe en papel y que nadie ha pasado a recogerlo.
  //
  // Se mira DESPUÉS de `delivered` en la pantalla: una entregada también tiene fecha de
  // impresión, y decir «Impresa» de algo que ya se entregó sería ir para atrás.
  public get printed(): boolean {
    return !!this.printedAt;
  }

  // Solo se puede entregar lo que está activo y todavía no se entregó; el backend
  // responde «El carnet ya fue entregado» si se insiste, y de a uno con un 500.
  public get deliverable(): boolean {
    return this.statusCode === 'ACTIVE' && !this.delivered;
  }

  // Revertir la entrega e inactivar son terminales: solo tienen sentido mientras la
  // acreditación siga viva.
  public get active(): boolean {
    return this.statusCode === 'ACTIVE';
  }

  // Los badges del diseño hablan de activa/inactiva; cualquier estado distinto de
  // ACTIVE se pinta como inactiva hasta que haya diseño para SUSPENDED y REVOKED.
  public get status(): CatalogStatus {
    return this.statusCode === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  }
}

// Lo que añade GET /accreditations/{code} sobre el listado: el token público del QR,
// la fecha de modificación y los permisos con sus usos y vigencias.
export class AccreditedRecordDetail extends AccreditedRecord {
  constructor(
    id: string,
    eventId: number,
    document: string,
    fullName: string,
    roleCode: string,
    roleName: string,
    statusCode: string,
    permissionsTotal: number,
    usesConsumed: number,
    createdAt: Date,
    departmentName: string,
    deliveredAt: Date | null,
    deliveredByCode: string | null,
    public readonly qrPublicToken: string | null,
    public readonly updatedAt: Date | null,
    public readonly permissions: AccreditationPermission[],
    // Los datos deportivos del titular. Null no es un error: el apoyo y los
    // deportes de conjunto no los tienen.
    public readonly sportsInfo: AccreditationSportsInfo | null = null,
    // Cuando el servicio de deportes no responde, el backend manda el motivo.
    public readonly sportsInfoError: string | null = null,
    // URL prefirmada de vida corta: no se persiste ni se cachea.
    public readonly photoUrl: string | null = null,
    public readonly certificateUrl: string | null = null,
    // El lote del carnet vigente, para saber qué ofrecer sin tener que emitirlo. Ver
    // `AccreditedRecordDetailResponse`.
    public readonly batchCode: string | null = null,
    public readonly batchStatus: string | null = null,
    // Prefirmada y de diez minutos, como `photoUrl`.
    public readonly cardUrl: string | null = null,
    // Cuántas veces se abrió el QR público. Es OTRO eje que las validaciones en puerta: ver
    // `public_views_count` en el contrato. Cero por defecto y no null: «nadie la ha abierto»
    // es un dato, no una ausencia, y el campo se pinta igual.
    public readonly publicViews = 0,
    // La categoría del tipo de acreditado; null en tipos viejos que nunca la recibieron.
    public readonly platformRole: string | null = null
  ) {
    super(
      id,
      eventId,
      document,
      fullName,
      roleCode,
      roleName,
      statusCode,
      permissionsTotal,
      usesConsumed,
      createdAt,
      departmentName,
      deliveredAt,
      deliveredByCode
    );
  }

  // Cambiar el tipo SOLO aplica al personal de apoyo con varias funciones (docente entrenador
  // ↔ docente asistente), y sobre una acreditación activa. El backend rechaza el resto.
  public get canChangeRole(): boolean {
    return this.active && this.platformRole === SUPPORT_PERSONNEL;
  }
}

// Los datos deportivos del titular, resueltos en vivo contra el módulo de eventos.
export class AccreditationSportsInfo {
  constructor(
    public readonly sportName: string,
    public readonly categoryName: string,
    public readonly disciplines: string[]
  ) {}

  // Sin ningún dato no vale la pena pintar el bloque.
  public get empty(): boolean {
    return !this.sportName && !this.categoryName && !this.disciplines.length;
  }
}

// Un movimiento de la auditoría de la acreditación.
export class AccreditationAudit {
  constructor(
    public readonly action: string,
    public readonly oldStatus: string | null,
    public readonly newStatus: string | null,
    public readonly changedByCode: string,
    public readonly changedAt: Date,
    public readonly comments: string | null,
    // El nombre de quien lo hizo, cuando el backend lo tiene. Los movimientos anteriores al
    // despliegue del 31 de agosto llegan sin él y se quedan así: el historial no se reescribe.
    public readonly changedByName: string | null = null,
    // A QUIÉN se le hizo. Solo viene en la auditoría transversal del evento: en el historial
    // de una acreditación la persona es el dueño de la URL y el contrato no la repite.
    public readonly accreditationCode: string | null = null,
    public readonly fullName: string | null = null,
    public readonly documentNumber: string | null = null
  ) {}
}

// Los dos contadores del evento que pinta la banda superior.
export interface AccreditationCounters {
  generated: number;
  delivered: number;
}
