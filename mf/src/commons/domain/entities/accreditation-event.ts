import { Entity } from '@naowee-tech/sdk-frontend-web';

import type { AccreditationAction } from '../types/status.type';

// Bitácora de la acreditación: cada fila es una foto del momento, así que el
// tipo de acreditado se guarda aquí y no se lee de la acreditación (que puede
// cambiar después).
export class AccreditationEvent extends Entity {
  constructor(
    id: string,
    public readonly accreditationId: string,
    public readonly accreditedType: string,
    public readonly action: AccreditationAction,
    // Contexto de la acción; el diseño solo lo usa para el lote al generar.
    public readonly detail: string,
    // Observaciones de la entrega o motivo de la inactivación.
    public readonly note: string,
    // Validaciones consumidas al momento del evento; el control de accesos las
    // pinta como "11/30" contra el tope de la acreditación. 0 si no es lectura.
    public readonly validations: number,
    public readonly createdAt: Date,
    public readonly author: string
  ) {
    super(id);
  }

  // El diseño muestra las validaciones usadas con dos dígitos ("09/15").
  public get validationsLabel(): string {
    return String(this.validations).padStart(2, '0');
  }
}
