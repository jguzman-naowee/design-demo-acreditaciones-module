import { Entity } from '@naowee-tech/sdk-frontend-web';

import type { CatalogStatus, DeliveryStatus } from '../types/status.type';

// Las cuatro situaciones en que puede estar una fila de esta lista. Van juntas en un solo
// valor y no en tres banderas sueltas porque la tabla, las acciones y la selección tienen que
// leer LO MISMO: con banderas separadas ya pasó que una entregada se pintara «sin entregar»
// por mirar el eje equivocado.
export type AccreditationRowState =
  | 'NONE'
  | 'ACTIVE'
  | 'DELIVERED'
  | 'INACTIVE';

// Un participante con su documentación aprobada: candidato a acreditar. Todavía NO es
// una persona del módulo de acreditación —eso se crea al acreditarlo— así que lo único
// que lo identifica es el código de su registro de origen.
export class ReadyParticipant extends Entity {
  constructor(
    // El id es el CÓDIGO DE ESTA FILA, y cuál de los dos es lo dice `identityType`: el
    // `user_code` de la plataforma para quien tiene cuenta, y el `mission_staff_code` del
    // registro de misión para quien no la tiene.
    //
    // Decía «el id es el user_code» y hoy sería mentira para el personal de misión: mandarlo
    // como `user_code` lo dejaría en `skipped` con «No se encontró el usuario en la
    // plataforma». Todo lo que lo lee —la selección de las dos pantallas y el ítem del
    // masivo— tiene que mirar antes `identityType`.
    id: string,
    public readonly roleCode: string,
    public readonly firstName: string,
    public readonly secondName: string,
    public readonly lastName: string,
    public readonly secondLastName: string,
    public readonly documentType: string,
    public readonly document: string,
    public readonly departmentCode: string,
    public readonly departmentName: string,
    public readonly requirementsApproved: number,
    public readonly requirementsTotal: number,
    // Cuántos lleva cargados, que no es lo mismo que aprobados.
    public readonly requirementsLoaded = 0,
    // Lo que dice documentation-ms del conjunto. APPROVED también cuando no hay proceso
    // documental que lo cubra, y ahí `requirementsTotal` viene en 0.
    public readonly overallStatus = '',
    // Deporte y territorio de la inscripción (los hidrata el gateway contra orc). Los
    // códigos son los que viajan al filtro; los nombres, lo que se muestra.
    public readonly sportNames: string[] = [],
    public readonly sportCodes: string[] = [],
    public readonly municipalityCode = '',
    public readonly municipalityName = '',
    public readonly organizationName = '',
    // Con qué identificador se acredita. Respaldo PLATFORM_USER porque el backend solo manda
    // la clave en las filas de misión.
    public readonly identityType: 'PLATFORM_USER' | 'MISSION_STAFF' = 'PLATFORM_USER',
    // La función del personal de apoyo, que `roleCode` no distingue. Lista, porque se asigna
    // por deporte.
    public readonly supportRoleCodes: string[] = [],
    public readonly supportRoleNames: string[] = [],
    // Si esta persona YA está acreditada. Nulos cuando no lo está —y en la respuesta las tres
    // claves ni siquiera vienen, así que la factory las lee con `??`—.
    public readonly accreditationCode: string | null = null,
    public readonly accreditationStatus: CatalogStatus | null = null,
    public readonly deliveryStatus: DeliveryStatus | null = null,
    // La manda el backend en la fila; ver `ReadyParticipantResponse.region_name`.
    public readonly regionCode = '',
    public readonly regionName = ''
  ) {
    super(id);
  }

  // En cuál de las cuatro situaciones está. El orden importa: una acreditación ENTREGADA
  // sigue estando activa, así que la entrega se mira antes que el estado; y una INACTIVA no
  // se anuncia por su entrega, que ya no significa nada.
  public get accreditationState(): AccreditationRowState {
    if (!this.accreditationCode) {
      return 'NONE';
    }

    if (this.accreditationStatus === 'INACTIVE') {
      return 'INACTIVE';
    }

    return this.deliveryStatus === 'DELIVERED' ? 'DELIVERED' : 'ACTIVE';
  }

  // Si se le puede emitir una acreditación. Es la regla que el `exclude_accredited` venía
  // aplicando por nosotros al esconder a esta gente: acreditar a quien ya tiene una ACTIVA
  // devuelve 409 «una acreditación por persona y evento».
  //
  // Una INACTIVA sí se puede volver a acreditar —es justo el caso de la reacreditación— y por
  // eso `exclude_accredited` nunca las restó.
  public get accreditable(): boolean {
    const estado = this.accreditationState;

    return estado === 'NONE' || estado === 'INACTIVE';
  }

  // Se acredita con `mission_staff_code`, no con `user_code`.
  public get isMissionStaff(): boolean {
    return this.identityType === 'MISSION_STAFF';
  }

  // «Docente/Entrenador, Auxiliar Discapacidad», o vacío si no es personal de apoyo. Los
  // nombres pueden faltar si el catálogo no respondió; ahí quedan los códigos, que al menos
  // identifican la función.
  public get supportRoleLabel(): string {
    const nombres = this.supportRoleNames.filter(Boolean);

    return (nombres.length ? nombres : this.supportRoleCodes).join(', ');
  }

  // Si se puede acreditar ya, o si le falta documentación por aprobar. Se mira el estado del
  // conjunto y no la cuenta: un participante sin proceso documental llega APPROVED con cero
  // requisitos, y contar «0 de 0» lo dejaría fuera siendo acreditable.
  public get documentsApproved(): boolean {
    return this.overallStatus === 'APPROVED';
  }

  // «3 de 5», para decirle a quien reclama su acreditación qué le falta sin salir del módulo.
  public get requirementsLabel(): string {
    return `${this.requirementsApproved} de ${this.requirementsTotal}`;
  }

  public get fullName(): string {
    return [this.firstName, this.secondName, this.lastName, this.secondLastName]
      .filter(Boolean)
      .join(' ');
  }

  // Sin departamento la persona se crearía sin delegación, y no hay forma de
  // corregirla después: la pantalla avisa antes de dejar ese dato incompleto.
  public get hasDepartment(): boolean {
    return !!this.departmentCode || !!this.departmentName;
  }

  // Un participante puede estar inscrito en más de un deporte.
  public get sportLabel(): string {
    return this.sportNames.filter(Boolean).join(', ');
  }

  // El municipio con el nombre resuelto; si el catálogo no respondió queda el código,
  // que al menos permite identificarlo.
  public get municipalityLabel(): string {
    return this.municipalityName || this.municipalityCode;
  }
}

// Un valor ofrecido por un desplegable de filtro.
export interface ParticipantFacet {
  code: string;
  label: string;
  total: number;
}

export interface ParticipantFacets {
  sports: ParticipantFacet[];
  departments: ParticipantFacet[];
  municipalities: ParticipantFacet[];
}
