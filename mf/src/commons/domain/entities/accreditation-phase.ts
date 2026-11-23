// Fase de un evento con proceso de acreditación. El módulo registra una fila por
// CADA fase que tenga `has_accreditation_process`, y el `event_id` que exigen los
// roles y las acreditaciones identifica al par evento+fase, no al evento: por eso
// hay que elegir la fase y no se puede asumir que haya una sola.
export class AccreditationPhase {
  constructor(
    // Es el mismo uuid que el módulo de acreditación guarda como phase_code.
    public readonly code: string,
    public readonly name: string,
    public readonly sequenceNumber: number,
    // Cuándo arranca la fase. El catálogo del módulo no manda fechas —solo el
    // `created_at` del registro—, así que esta es la única que hay para mostrar. Y es
    // la que corresponde: se trabaja por fase, no por evento.
    public readonly startDate: Date | null = null,
    // Momento de la fase (orc `phase_moments`). Una fase dividida en momentos —p. ej.
    // atletismo y deportes de conjunto— se acredita por momento: cada uno es su propio
    // `event_id` en el módulo, con sus tipos, carnets y acreditaciones. Nulo = la fase entera.
    public readonly momentCode: string | null = null,
    public readonly momentName: string | null = null,
    // Los deportes que se acreditan en el momento, tal como los configuró el admin en orc.
    public readonly momentSportCodes: string[] = []
  ) {}

  // Los listados por event_code (carnets, lotes) siempre van con la fase; el momento
  // solo si lo hay: con dos momentos, la misma persona tiene dos carnets.
  public get momentScope(): Record<string, string> {
    return {
      phase_code: this.code,
      ...(this.momentCode ? { moment_code: this.momentCode } : {})
    };
  }

  // Las facetas de orc son de la fase entera: en un momento solo tienen sentido sus
  // deportes (un momento sin deportes no tiene deportistas ni apoyo que filtrar).
  public keepMomentSports<T extends { code: string }>(sports: T[]): T[] {
    if (!this.momentCode) {
      return sports;
    }

    return sports.filter((sport) => this.momentSportCodes.includes(sport.code));
  }

  // Lo que se muestra: «Regionales» o, si es un momento, «Regionales · Atletismo».
  public get label(): string {
    return this.momentName ? `${this.name} · ${this.momentName}` : this.name;
  }

  // Identifica la unidad elegida: la fase sola no alcanza cuando tiene momentos.
  public get key(): string {
    return this.momentCode ? `${this.code}:${this.momentCode}` : this.code;
  }
}
