import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { canManageUserUtil } from '@/modules/users/utils/can-manage-user.util';

const user = (id: string, ...roles: UserRoles[]) => ({ id, roles });

describe('canManageUserUtil', () => {
  const superUser = user('s', UserRoles.SUPER);
  const admin = user('a', UserRoles.ADMIN);
  const otherAdmin = user('a2', UserRoles.ADMIN);
  const client = user('c', UserRoles.CLIENT);
  const staff = user('u', UserRoles.USER);

  it('nobody can act on themselves', () => {
    expect(canManageUserUtil(superUser, superUser)).toBe(false);
    expect(canManageUserUtil(admin, admin)).toBe(false);
  });

  it('nobody can act on a SUPER', () => {
    expect(canManageUserUtil(admin, superUser)).toBe(false);
    expect(canManageUserUtil(user('s2', UserRoles.SUPER), superUser)).toBe(
      false,
    );
  });

  it('SUPER can act on admins, clients and users', () => {
    expect(canManageUserUtil(superUser, admin)).toBe(true);
    expect(canManageUserUtil(superUser, client)).toBe(true);
    expect(canManageUserUtil(superUser, staff)).toBe(true);
  });

  it('ADMIN can act on non-admins only', () => {
    expect(canManageUserUtil(admin, client)).toBe(true);
    expect(canManageUserUtil(admin, staff)).toBe(true);
    expect(canManageUserUtil(admin, otherAdmin)).toBe(false);
  });

  it('clients and users cannot manage anybody', () => {
    expect(canManageUserUtil(client, staff)).toBe(false);
    expect(canManageUserUtil(staff, client)).toBe(false);
  });
});
