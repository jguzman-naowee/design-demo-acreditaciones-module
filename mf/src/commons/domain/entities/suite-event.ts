import { Entity, type EntityId } from '@naowee-tech/sdk-frontend-web';

// Evento del módulo de eventos (events-lite), que es de donde sale la lista para
// el selector. No confundir con AccreditationEvent, que es un movimiento de la
// bitácora de una acreditación.
export class SuiteEvent extends Entity {
  constructor(
    // El id es el event_code (uuid) porque es lo que pide el módulo de
    // acreditación para resolver su propio event_id entero.
    id: EntityId,
    public readonly name: string,
    public readonly startDate: Date | null
  ) {
    super(id);
  }

  public get code(): string {
    return String(this.id);
  }
}
