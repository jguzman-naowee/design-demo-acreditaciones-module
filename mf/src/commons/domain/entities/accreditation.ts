import { Entity } from '@naowee-tech/sdk-frontend-web';

import type { CatalogStatus, DeliveryStatus } from '../types/status.type';

// Permiso concedido a la acreditación, con sus usos y su vigencia. Es la forma que
// devuelve GET /accreditations/{code}.
export class AccreditationPermission {
  constructor(
    public readonly permissionId: number,
    public readonly permissionName: string,
    public readonly hasLimit: boolean,
    public readonly maxUsesPerPerson: number | null,
    public readonly usedCount: number,
    public readonly validFrom: Date | null,
    public readonly validTo: Date | null,
    // El icono se cruza con el catálogo de permisos; puede no estar.
    public readonly fileIconUploadId: string | null,
    // Zona y sede del permiso, texto libre del backend.
    public readonly zoneName = '',
    public readonly venueName = ''
  ) {}

  // Las dos se muestran juntas: son dos textos del mismo sitio.
  public get place(): string {
    return [this.zoneName, this.venueName].filter(Boolean).join(' · ');
  }

  // El diseño muestra los usos como "0/5"; sin tope no hay contador que mostrar.
  public get usesLabel(): string | null {
    return this.hasLimit && this.maxUsesPerPerson !== null
      ? `${this.usedCount}/${this.maxUsesPerPerson}`
      : null;
  }
}

export class Accreditation extends Entity {
  constructor(
    id: string,
    // Se guarda el id del lote además del número: navegar al detalle armando
    // `batch-${number}` se rompería en cuanto el back devuelva otro formato.
    public readonly batchId: string,
    public readonly batchNumber: number,
    public readonly accreditedType: string,
    public readonly documentType: string,
    public readonly document: string,
    public readonly firstName: string,
    public readonly secondName: string,
    public readonly lastName: string,
    public readonly secondLastName: string,
    public readonly sex: string,
    public readonly email: string,
    public readonly delegation: string,
    public readonly userType: string,
    public readonly role: string,
    // Id que identifica la acreditación en los accesos; el diseño lo muestra
    // con ocho dígitos ("00000001").
    public readonly validationCode: string,
    // Validaciones consumidas en los accesos y el tope que le da su tipo de
    // acreditado. El listado los muestra como "10/30".
    public readonly validations: number,
    public readonly validationLimit: number,
    public readonly createdAt: Date,
    public readonly expiresAt: Date | null,
    // Se sella al descargar el lote; null mientras no se ha impreso.
    public readonly printedAt: Date | null,
    public readonly modifiedAt: Date | null,
    public readonly status: CatalogStatus,
    public readonly deliveryStatus: DeliveryStatus,
    // Los permisos que la acreditación concede, que son los que el perfil pinta.
    public readonly permissions: AccreditationPermission[]
  ) {
    super(id);
  }

  public get fullName(): string {
    return [this.firstName, this.secondName, this.lastName, this.secondLastName]
      .filter(Boolean)
      .join(' ');
  }

  // El diseño muestra el lote con tres dígitos ("019").
  public get batchLabel(): string {
    return String(this.batchNumber).padStart(3, '0');
  }

  // El diseño muestra las validaciones usadas con dos dígitos ("09/15").
  public get validationsLabel(): string {
    return String(this.validations).padStart(2, '0');
  }
}
