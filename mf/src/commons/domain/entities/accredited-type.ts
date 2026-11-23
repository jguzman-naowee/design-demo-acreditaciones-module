import { Entity, type EntityId } from '@naowee-tech/sdk-frontend-web';

import type { CatalogStatus } from '../types/status.type';

// Permiso ya asignado a un tipo de acreditado, con su tope de usos por persona.
export class AccreditedTypePermission {
  constructor(
    public readonly permissionId: number,
    public readonly permissionName: string,
    public readonly hasLimit: boolean,
    // null significa sin tope, según el contrato.
    public readonly maxUsesPerPerson: number | null,
    // La posición que el usuario le dio dentro del tipo, y con la que el carnet pinta los
    // iconos (SUV2-2330). La lista ya llega ordenada por ella, así que la pantalla usa la
    // POSICIÓN del array y este campo está para no perder lo que el backend guardó —puede
    // traer huecos— y para poder afirmarlo. Opcional: un rol guardado antes del despliegue
    // no lo trae.
    public readonly order?: number
  ) {}
}

export class AccreditedType extends Entity {
  constructor(
    id: EntityId,
    // El uuid con el que se edita y se activa/inactiva.
    public readonly code: string,
    // El nombre para mostrar, ya sin el código pegado. Ver toRoleLabel.
    public readonly typeName: string,
    // Código único del rol dentro del evento; se deriva del nombre.
    public readonly roleCode: string,
    public readonly eventId: number,
    public readonly isActive: boolean,
    // La «fecha límite de acceso» del diseño, que el backend ya guarda por rol.
    public readonly accessDeadline: Date | null,
    public readonly permissions: AccreditedTypePermission[],
    // El `role_name` TAL CUAL lo tiene guardado el backend. Existe solo para devolverlo en el
    // PUT: ese endpoint reemplaza el rol completo, así que mandar el nombre ya limpio lo
    // RENOMBRARÍA —«Deportista (ATHLETE)» pasaría a «Deportista»— y editar los permisos de un
    // tipo no tiene por qué cambiarle el nombre a nadie.
    public readonly rawName = typeName,
    // El rol que reconoce la plataforma, aparte del código del evento. Opcional porque los
    // tipos creados antes del despliegue de backend no lo traen.
    // La familia, tal como la publica `role-catalog`. Sin unión cerrada: cerrarla obligaba a
    // tocar el front cada vez que backend añadía una.
    public readonly platformRole?: string,
    // La FUNCIÓN dentro de esa categoría (FISIOTERAPEUTA, ENT…). Sin ella, el tipo es el que
    // el backend usa POR DEFECTO para toda su categoría.
    public readonly platformSubrole?: string
  ) {
    super(id);
  }

  public get status(): CatalogStatus {
    return this.isActive ? 'ACTIVE' : 'INACTIVE';
  }

  // El diseño muestra un único «Límite de validaciones» por tipo, pero el
  // backend lo guarda por permiso: se expone el mayor de los declarados, y null
  // si ningún permiso tiene tope.
  public get validationLimit(): number | null {
    const limits = this.permissions
      .map((permission) => permission.maxUsesPerPerson)
      .filter((limit): limit is number => limit !== null);

    return limits.length ? Math.max(...limits) : null;
  }
}
