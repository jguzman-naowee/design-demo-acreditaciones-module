// El tipo de acreditado del evento que ocupa una función, o el genérico de su familia.
export class RoleCatalogType {
  constructor(
    public readonly code: string,
    // El del TIPO, texto libre por evento. NO sirve para acreditar: para eso está
    // `RoleCatalogFunction.accreditCode`.
    public readonly roleCode: string,
    public readonly roleName: string,
    public readonly active: boolean
  ) {}
}

export class RoleCatalogFunction {
  constructor(
    // El valor válido de `platform_subrole`.
    public readonly code: string,
    public readonly name: string,
    // Con qué código llega la persona. Hoy trae uno solo, igual al `code`.
    public readonly eventRoleCodes: string[] = [],
    // Lo que se manda al acreditar. Usar el `roleCode` del tipo da el 404 de «no existe el
    // tipo en el evento»: son distintos cuando el tipo se creó con un código propio.
    public readonly accreditCode = '',
    public readonly enrolled: number | null = null,
    public readonly configuredType: RoleCatalogType | null = null
  ) {}

  // Ya hay un tipo del evento con esta función: ofrecerla otra vez lleva al 409.
  public get configured(): boolean {
    return !!this.configuredType;
  }
}

export class RoleCatalogFamily {
  constructor(
    // El valor válido de `platform_role`.
    public readonly code: string,
    public readonly name: string,
    // `MISSION_STAFF` se acredita con `mission_staff_code`; el resto con `user_code`.
    public readonly identityType: 'PLATFORM_USER' | 'MISSION_STAFF' = 'PLATFORM_USER',
    public readonly allowsFunctions = false,
    public readonly functionsSource = 'NONE',
    public readonly defaultType: RoleCatalogType | null = null,
    public readonly functions: RoleCatalogFunction[] = []
  ) {}

  // Las funciones de misión salen de las inscripciones, así que un evento sin inscritos las
  // trae vacías. No es un fallo, y la pantalla tiene que decirlo en vez de parecer rota.
  public get dependsOnEnrollment(): boolean {
    return this.functionsSource === 'EVENT_ENROLLMENT';
  }
}
