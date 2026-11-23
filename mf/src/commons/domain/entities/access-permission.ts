import { Entity, type EntityId } from '@naowee-tech/sdk-frontend-web';

import type { CatalogStatus } from '../types/status.type';

export class AccessPermission extends Entity {
  constructor(
    // El id es el numérico: es con el que los tipos de acreditado asignan sus
    // permisos y con el que la acreditación los devuelve.
    id: EntityId,
    // El uuid, que es por donde van las escrituras (PATCH y los toggles). Los dos
    // conviven porque el backend usa uno para cada cosa.
    public readonly code: string,
    public readonly name: string,
    public readonly description: string,
    // El backend distingue si el permiso lleva tope de usos; el tope en sí se
    // define por rol, al asignar el permiso.
    public readonly hasLimit: boolean,
    // upload_id de file-storage; para verlo hay que pedir su download-url.
    public readonly fileIconUploadId: string | null,
    // Texto libre: el backend no tiene catálogo de zonas ni de sedes.
    public readonly zoneName: string,
    public readonly venueName: string,
    public readonly isActive: boolean
  ) {
    super(id);
  }

  // El backend guarda un booleano y la presentación habla de CatalogStatus; el
  // getter deja que las ayudas de estado sigan sirviendo sin duplicar mapeos.
  public get status(): CatalogStatus {
    return this.isActive ? 'ACTIVE' : 'INACTIVE';
  }

  // Zona y sede se muestran juntas: son dos textos libres del mismo sitio, y
  // separarlas en dos columnas dejaría la tabla llena de guiones.
  public get place(): string {
    return [this.zoneName, this.venueName].filter(Boolean).join(' · ');
  }
}
