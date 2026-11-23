import { Entity } from '@naowee-tech/sdk-frontend-web';

// Un PDF del lote. Se parte en varios cuando son muchos carnets; el individual
// siempre trae uno.
export class CardBatchChunk {
  constructor(
    public readonly index: number,
    public readonly cardCount: number,
    public readonly statusCode: string,
    public readonly uploadId: string | null,
    public readonly errorDetail: string | null
  ) {}

  // El upload_id aparece desde que el chunk está en cola, así que tenerlo no
  // significa que el archivo exista: solo está descargable cuando terminó.
  public get downloadable(): boolean {
    return this.statusCode === 'COMPLETED' && !!this.uploadId;
  }
}

// Quién va dentro del lote.
//
// El documento llega VACÍO: el endpoint del detalle del lote todavía no lo manda (ver el
// `TODO(api)` de `CardBatchAccreditationResponse`). Se declara igual, con su defecto, para que
// la tabla ya pueda pedirlo y se encienda sola cuando exista. Cadena vacía y no `null` para
// que quien pinte pregunte por verdad y no tenga que distinguir dos formas de «no hay».
export class CardBatchMember {
  constructor(
    public readonly code: string,
    public readonly fullName: string,
    public readonly document = ''
  ) {}
}

// Un carnet que se pidió y no salió: quién es y por qué no.
export class CardBatchSkip {
  constructor(
    public readonly code: string,
    public readonly reason: string,
    public readonly fullName = ''
  ) {}

  // El nombre cuando llega; si no, el uuid, que al menos identifica la fila.
  public get label(): string {
    return this.fullName || this.code;
  }
}

// El número del lote dentro del evento es lo que la gente usa para nombrarlo. Los lotes
// creados antes de que el backend lo numerara —y el camino de demo— no lo traen, así que
// se cae al prefijo del uuid, que al menos identifica la fila a ojo.
function batchLabel(number: number | null, code: string): string {
  return number === null ? shortBatchCode(code) : `#${number}`;
}

function shortBatchCode(code: string): string {
  return code.slice(0, 8);
}

// El lote de carnets que produce el backend al pedir un PDF.
export class CardBatch extends Entity {
  constructor(
    // El id es el batch_code: es lo que se consulta para saber si el PDF ya está.
    id: string,
    public readonly statusCode: string,
    public readonly totalCards: number,
    public readonly totalChunks: number,
    public readonly cardsWithoutPhoto: string[],
    public readonly chunks: CardBatchChunk[],
    public readonly createdAt: Date | null,
    public readonly batchNumber: number | null = null,
    // Vacía mientras el lote no haya terminado: el backend no los expone hasta entonces.
    public readonly members: CardBatchMember[] = [],
    public readonly skipped: CardBatchSkip[] = [],
    // El motivo del fallo del LOTE. Ver el getter `errorDetail`.
    public readonly batchErrorDetail: string | null = null
  ) {
    super(id);
  }

  // «#7», o el prefijo del uuid en los lotes que no llevan número.
  public get label(): string {
    return batchLabel(this.batchNumber, String(this.id));
  }

  public get generating(): boolean {
    return !this.finished;
  }

  public get finished(): boolean {
    return (
      this.statusCode === 'COMPLETED' ||
      this.statusCode === 'COMPLETED_WITH_ERRORS' ||
      this.statusCode === 'FAILED' ||
      this.statusCode === 'DELETED'
    );
  }

  public get failed(): boolean {
    return this.statusCode === 'FAILED';
  }

  // El primer PDF descargable. Con un carnet individual es el único que hay; para un
  // lote grande esta pantalla no sirve y hará falta la lista de chunks.
  public get file(): CardBatchChunk | null {
    return this.chunks.find((chunk) => chunk.downloadable) ?? null;
  }

  // El motivo del fallo, mirando los DOS sitios donde el backend lo pone.
  //
  // Decía «FAILED explica el motivo en el chunk, no en el lote», y era cierto hasta
  // SUV2-2278: los fallos venían de generar el PDF, o sea de un chunk concreto. Ahora hay un
  // segundo camino —el lote que no responde y a los quince minutos pasa a FAILED— cuyo
  // motivo está en el LOTE y que puede no tener ningún chunk con error. Leyendo solo el
  // chunk, ese mensaje se perdía y la pantalla caía a su texto genérico.
  //
  // Primero el del lote: cuando existe es el que explica por qué se acabó todo, mientras que
  // el del chunk explica por qué falló una parte.
  public get errorDetail(): string | null {
    return (
      this.batchErrorDetail ??
      this.chunks.find((chunk) => chunk.errorDetail)?.errorDetail ??
      null
    );
  }
}

// Un acreditado CON carnet, visto desde el listado aplanado: la persona y su lote en la
// misma fila. Es lo que pinta «Lista de acreditados».
export class CardBatchMemberRecord extends Entity {
  constructor(
    // El id es COMPUESTO —acreditación + lote— y no el `accreditation_code` a secas.
    //
    // Está sin confirmar si el endpoint devuelve una fila por persona con su lote más
    // reciente o una por cada carnet generado (medido en dev el 2026-09-03: los tres lotes
    // que hay tienen una persona distinta cada uno, así que el caso no se puede observar).
    // Con el código de la acreditación como id, la segunda forma rompía de dos maneras
    // distintas según el momento, y las dos medidas sobre el Store del SDK:
    //
    //   primera carga  → `new List(...)` llama a `set()`, que NO deduplica: dos filas con la
    //                    misma clave de React.
    //   al refrescar   → `merge()` hace `replace` en vez de `append`: una de las dos filas
    //                    desaparece en silencio.
    //
    // Dos filas al entrar y una al refrescar es de lo peor que se puede depurar. Con el id
    // compuesto la tabla aguanta las dos formas y deja de depender de la respuesta.
    id: string,
    public readonly fullName: string,
    public readonly document: string,
    public readonly roleCode: string,
    public readonly roleName: string,
    public readonly statusCode: string,
    public readonly delivered: boolean,
    public readonly batchCode: string,
    public readonly batchNumber: number | null,
    public readonly batchKindCode: string,
    // El código de la acreditación, aparte del id: es lo que abre su detalle y su credencial,
    // y ya no se puede sacar del id porque ese lleva el lote pegado.
    public readonly accreditationCode = id,
    // El territorio de la delegación. Igual que en acreditables: el municipio manda en la
    // primera línea y el departamento debajo, porque es el que ubica.
    public readonly departmentName = '',
    public readonly municipalityName = '',
    // Los datos de la persona cambiaron después de imprimir su carnet: hay que reimprimirlo.
    public readonly cardOutdated = false
  ) {
    super(id);
  }

  public get batchLabel(): string {
    return batchLabel(this.batchNumber, this.batchCode);
  }

  // Un carnet pedido de a uno no vino de un lote de verdad, y llamarlo «lote» en la tabla
  // haría pensar que hay más gente dentro.
  public get individual(): boolean {
    return this.batchKindCode === 'INDIVIDUAL';
  }

  public get active(): boolean {
    return this.statusCode === 'ACTIVE';
  }

  // Solo se puede entregar lo que está activo y todavía no se entregó. Misma regla que en
  // `AccreditedRecord`: el backend responde «El carnet ya fue entregado» si se insiste.
  public get deliverable(): boolean {
    return this.active && !this.delivered;
  }
}

// Un lote tal como lo devuelve el LISTADO: sin chunks, y con el conteo de carnets
// sin foto en lugar de la lista.
export class CardBatchListed extends Entity {
  constructor(
    id: string,
    public readonly batchNumber: number | null,
    public readonly eventCode: string,
    public readonly kindCode: string,
    public readonly statusCode: string,
    public readonly totalCards: number,
    public readonly totalChunks: number,
    public readonly cardsWithoutPhoto: number,
    public readonly requestedBy: string | null,
    public readonly createdAt: Date | null
  ) {
    super(id);
  }

  public get label(): string {
    return batchLabel(this.batchNumber, String(this.id));
  }

  // El uuid completo es lo que hay que pegarle a backend cuando algo falla, así que la
  // tabla lo enseña en pequeño al lado del número en lugar de esconderlo.
  public get shortCode(): string {
    return shortBatchCode(String(this.id));
  }

  public get kind(): string {
    return this.kindCode === 'INDIVIDUAL' ? 'Individual' : 'Del evento';
  }

  public get finished(): boolean {
    return (
      this.statusCode === 'COMPLETED' ||
      this.statusCode === 'COMPLETED_WITH_ERRORS' ||
      this.statusCode === 'FAILED' ||
      this.statusCode === 'DELETED'
    );
  }

  // Solo un lote terminado, sin fallar y sin inactivar tiene PDF que ofrecer. DELETED hay
  // que excluirlo A MANO: al contarlo como terminal, `finished` dejó de bastar.
  public get downloadable(): boolean {
    return (
      this.finished &&
      this.statusCode !== 'FAILED' &&
      this.statusCode !== 'DELETED'
    );
  }
}
