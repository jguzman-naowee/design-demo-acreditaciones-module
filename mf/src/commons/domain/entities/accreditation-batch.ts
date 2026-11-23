import { Entity } from '@naowee-tech/sdk-frontend-web';

import type { BatchStatus } from '../types/status.type';

export interface BatchPerson {
  accreditedType: string;
  document: string;
  fullName: string;
}

export class AccreditationBatch extends Entity {
  constructor(
    id: string,
    public readonly number: number,
    public readonly createdAt: Date,
    // total lo envía el back: el arreglo people es solo el detalle visible.
    public readonly total: number,
    public readonly delivered: number,
    public readonly status: BatchStatus,
    public readonly people: BatchPerson[]
  ) {
    super(id);
  }

  public get label(): string {
    return `Lote ${this.number}`;
  }

  // El diseño muestra un solo tipo por lote; si la selección mezcló tipos se
  // resume en "Varios" en vez de mentir con el primero.
  public get typeLabel(): string {
    const types = [
      ...new Set(this.people.map((person) => person.accreditedType))
    ];

    if (!types.length) {
      return '—';
    }

    return types.length === 1 ? types[0] : 'Varios';
  }
}
