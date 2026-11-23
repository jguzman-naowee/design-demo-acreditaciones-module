import { Entity } from '@naowee-tech/sdk-frontend-web';

// La persona acreditable, con los nombres por separado que el diseño pide campo a
// campo y que la acreditación no trae.
export class AccreditationPerson extends Entity {
  constructor(
    id: string,
    // El usuario de la suite: es la IDENTIDAD con la que el backend emite la
    // acreditación, no el documento. Una acreditación por usuario+evento.
    public readonly userCode: string,
    public readonly document: string,
    public readonly firstName: string,
    public readonly secondName: string,
    public readonly lastName: string,
    public readonly secondLastName: string,
    public readonly sex: string,
    public readonly email: string,
    // Delegación (departamento). El contrato ya la trae; en dev llega vacía.
    public readonly departmentName = ''
  ) {
    super(id);
  }
}
