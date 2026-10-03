import { UserRoles } from '@/core/auth/enums/user-roles.enum';

interface UserLike {
  id: string;
  roles: UserRoles[];
}

/**
 * Reglas para activar/desactivar usuarios y gestionar el rol admin (las mismas
 * que aplica el panel web):
 * - Nadie puede actuar sobre sí mismo.
 * - Nadie puede actuar sobre un SUPER.
 * - SUPER puede actuar sobre cualquier otro usuario.
 * - ADMIN solo puede actuar sobre usuarios que no son ADMIN.
 */
export const canManageUserUtil = (
  actor: UserLike,
  target: UserLike,
): boolean => {
  if (actor.id === target.id) return false;
  if (target.roles?.includes(UserRoles.SUPER)) return false;
  if (actor.roles?.includes(UserRoles.SUPER)) return true;
  if (actor.roles?.includes(UserRoles.ADMIN))
    return !target.roles?.includes(UserRoles.ADMIN);
  return false;
};
