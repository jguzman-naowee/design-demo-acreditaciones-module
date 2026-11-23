import { Entity } from '@naowee-tech/sdk-frontend-web';

// El resultado de UN permiso en una lectura del punto de acceso.
export class ValidationResult {
  constructor(
    public readonly permissionId: number,
    // Null cuando la acreditación no tiene ese permiso: el backend no le pone nombre.
    public readonly permissionName: string | null,
    public readonly resultCode: string,
    // El motivo del rechazo lo redacta el backend, en español.
    public readonly reason: string | null,
    public readonly usedCount: number | null,
    public readonly maxUsesPerPerson: number | null
  ) {}

  public get granted(): boolean {
    return this.resultCode === 'GRANTED';
  }

  // El diseño muestra los usos como «1/5»; sin tope no hay denominador.
  public get usesLabel(): string | null {
    if (this.usedCount === null) {
      return null;
    }

    return this.maxUsesPerPerson !== null
      ? `${this.usedCount}/${this.maxUsesPerPerson}`
      : `${this.usedCount} · sin tope`;
  }
}

// Lo que la puerta necesita ver de un escaneo: a quién identificó el QR y qué pasó con
// cada permiso. Identifica a la persona incluso cuando todo se deniega.
export class AccreditationValidation extends Entity {
  constructor(
    id: string,
    public readonly fullName: string,
    public readonly roleName: string,
    public readonly statusCode: string,
    public readonly results: ValidationResult[]
  ) {
    super(id);
  }

  public get granted(): boolean {
    return this.results.some((result) => result.granted);
  }

  public get grantedCount(): number {
    return this.results.filter((result) => result.granted).length;
  }
}

// Una lectura ya registrada. El backend no le da id, así que se compone uno estable
// con lo que la identifica: la acreditación, el permiso y el instante.
export class ValidationLog extends Entity {
  constructor(
    // El consecutivo que manda el backend. Antes el id se componía a mano con
    // código+permiso+fecha porque no se sabía que el contrato traía uno.
    id: number,
    public readonly accreditationCode: string,
    public readonly validatorUserCode: string,
    public readonly permissionId: number,
    public readonly permissionName: string,
    public readonly resultCode: string,
    public readonly observation: string,
    public readonly scannedAt: Date,
    // Por qué se denegó, ya redactado por el backend. Las denegadas SÍ se registran: medido en
    // dev, siete de las catorce lecturas del evento 1.
    public readonly denialReason = '',
    // Los usos CONGELADOS en el momento de la lectura, no los de ahora. Null en las denegadas.
    public readonly usedCount: number | null = null,
    public readonly maxUsesPerPerson: number | null = null,
    // El nombre de quien la validó, cuando el backend lo tiene. Las lecturas anteriores al
    // despliegue del 31 de agosto llegan sin él.
    public readonly validatorName: string | null = null
  ) {
    super(id);
  }

  public get granted(): boolean {
    return this.resultCode === 'GRANTED';
  }

  // Lo que se lee de la lectura en una tabla: el permiso, y por qué no se dejó pasar o cuántos
  // usos llevaba consumidos en ese momento.
  public get detail(): string {
    return [
      this.permissionName,
      this.denialReason || null,
      this.usedCount !== null && this.maxUsesPerPerson !== null
        ? `${this.usedCount}/${this.maxUsesPerPerson} usos`
        : null,
      this.observation || null
    ]
      .filter(Boolean)
      .join(' · ');
  }
}
