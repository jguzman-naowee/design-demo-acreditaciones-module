import { Entity } from '@naowee-tech/sdk-frontend-web';

// Los nombres se guardan separados porque el detalle del acreditado los pide
// campo por campo: aplanarlos en un solo string sería irreversible.
export class EnabledPerson extends Entity {
  constructor(
    id: string,
    public readonly accreditedType: string,
    public readonly documentType: string,
    public readonly document: string,
    public readonly firstName: string,
    public readonly secondName: string,
    public readonly lastName: string,
    public readonly secondLastName: string,
    public readonly sex: string,
    public readonly email: string,
    public readonly delegation: string
  ) {
    super(id);
  }

  public get fullName(): string {
    return [this.firstName, this.secondName, this.lastName, this.secondLastName]
      .filter(Boolean)
      .join(' ');
  }
}
