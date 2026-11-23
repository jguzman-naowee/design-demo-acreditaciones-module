// El certificado de participación y su configuración. La fecha viaja como
// string ISO (yyyy-mm-dd): la pantalla la convierte a Date solo en el picker.

export class CertificateSportDate {
  constructor(
    // null = la fecha default del evento/fase.
    public readonly sportCode: string | null,
    public readonly deliveryDate: string,
    public readonly enabled: boolean
  ) {}
}

export class CertificateConfig {
  constructor(
    public readonly code: string,
    public readonly eventCode: string,
    public readonly phaseCode: string | null,
    public readonly templateCode: string,
    public readonly enabled: boolean,
    public readonly sports: CertificateSportDate[]
  ) {}

  public dateFor(sportCode: string | null): CertificateSportDate | undefined {
    return this.sports.find((sport) => sport.sportCode === sportCode);
  }
}

export class CertificateBatchRequested {
  constructor(
    public readonly batchCode: string,
    public readonly totalCertificates: number,
    public readonly deliveryDate: string
  ) {}
}

export class CertificateItem {
  constructor(
    public readonly code: string,
    public readonly accreditationCode: string,
    public readonly userCode: string | null,
    public readonly fullName: string,
    public readonly documentNumber: string,
    public readonly roleName: string,
    public readonly deliveryDate: string,
    public readonly uploadId: string | null,
    public readonly status: string,
    public readonly errorDetail: string | null
  ) {}
}

export class CertificateBatch {
  constructor(
    public readonly batchCode: string,
    public readonly kind: string,
    public readonly sportCode: string | null,
    public readonly deliveryDate: string,
    public readonly status: string,
    public readonly totalCertificates: number,
    public readonly errorDetail: string | null,
    public readonly certificates: CertificateItem[],
    public readonly createdAt: string | null = null
  ) {}

  public get finished(): boolean {
    return ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(
      this.status
    );
  }
}

// Deporte configurado del evento (competition-rules): las filas de fecha por
// deporte de la pantalla de configuración.
export class EventSport {
  constructor(
    public readonly code: string,
    public readonly name: string
  ) {}
}

// Acreditado activo elegible para generación individual.
export class ActiveAccredited {
  constructor(
    public readonly accreditationCode: string,
    public readonly userCode: string | null,
    public readonly fullName: string,
    public readonly documentNumber: string,
    public readonly roleName: string | null
  ) {}
}
