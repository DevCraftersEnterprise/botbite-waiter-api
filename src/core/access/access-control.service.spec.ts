import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';

const OWNER_ID = 'owner-id';

/** DataSource falso: cada consulta devuelve el dueño indicado. */
const dataSourceReturning = (ownerId: string | undefined) => {
  const qb = {
    select: () => qb,
    where: () => qb,
    innerJoin: () => qb,
    getRawOne: () => Promise.resolve(ownerId ? { ownerId } : undefined),
  };
  return {
    getRepository: () => ({ createQueryBuilder: () => qb }),
  } as unknown as DataSource;
};

describe('AccessControlService', () => {
  const owner = { id: OWNER_ID, roles: [UserRoles.CLIENT] };
  const otherClient = { id: 'other', roles: [UserRoles.CLIENT] };
  const admin = { id: 'admin', roles: [UserRoles.ADMIN] };
  const superUser = { id: 'super', roles: [UserRoles.SUPER] };
  const staff = { id: 'staff', roles: [UserRoles.USER] };

  const service = new AccessControlService(dataSourceReturning(OWNER_ID));

  it('lets the owner client access its branch', async () => {
    await expect(
      service.assertBranchAccess(owner, 'b1'),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['admin', admin],
    ['super', superUser],
  ])('lets %s access any branch', async (_name, user) => {
    await expect(
      service.assertBranchAccess(user, 'b1'),
    ).resolves.toBeUndefined();
  });

  it('forbids a client from another restaurant', async () => {
    await expect(service.assertBranchAccess(otherClient, 'b1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('forbids USER role, which is not linked to any restaurant', async () => {
    await expect(service.assertMenuAccess(staff, 'm1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns 404 when the resource does not exist', async () => {
    const empty = new AccessControlService(dataSourceReturning(undefined));
    await expect(empty.assertOrderAccess(admin, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('canAccessBranch returns a boolean instead of throwing', async () => {
    await expect(service.canAccessBranch(owner, 'b1')).resolves.toBe(true);
    await expect(service.canAccessBranch(otherClient, 'b1')).resolves.toBe(
      false,
    );
  });
});
