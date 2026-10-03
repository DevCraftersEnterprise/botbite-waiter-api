import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';

const OWNER_ID = 'owner-id';

/**
 * DataSource falso: las consultas de pertenencia devuelven el dueño indicado
 * y la de personal responde según `staffAssigned`.
 */
const fakeDataSource = (ownerId: string | undefined, staffAssigned = false) => {
  const qb = {
    select: () => qb,
    addSelect: () => qb,
    where: () => qb,
    andWhere: () => qb,
    innerJoin: () => qb,
    getRawOne: () =>
      Promise.resolve(
        ownerId ? { ownerId, restaurantId: 'r1', branchId: 'b1' } : undefined,
      ),
    getExists: () => Promise.resolve(staffAssigned),
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

  const service = new AccessControlService(fakeDataSource(OWNER_ID));
  const withAssignedStaff = new AccessControlService(
    fakeDataSource(OWNER_ID, true),
  );

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

  it('returns 404 when the resource does not exist', async () => {
    const empty = new AccessControlService(fakeDataSource(undefined));
    await expect(empty.assertOrderAccess(admin, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('staff (USER role)', () => {
    it('reads data of an assigned branch where the route allows it', async () => {
      await expect(
        withAssignedStaff.assertBranchAccess(staff, 'b1', 'branch'),
      ).resolves.toBeUndefined();
      await expect(
        withAssignedStaff.assertOrderAccess(staff, 'o1', 'branch'),
      ).resolves.toBeUndefined();
    });

    it('is denied by default, even when assigned (write routes)', async () => {
      await expect(
        withAssignedStaff.assertBranchAccess(staff, 'b1'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        withAssignedStaff.assertRestaurantAccess(staff, 'r1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('never manages menus', async () => {
      await expect(
        withAssignedStaff.assertMenuAccess(staff, 'm1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cannot read branches it is not assigned to', async () => {
      await expect(
        service.assertBranchAccess(staff, 'b1', 'branch'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('a client is never treated as staff', () => {
      expect(
        AccessControlService.isStaff({
          roles: [UserRoles.USER, UserRoles.CLIENT],
        }),
      ).toBe(false);
      expect(AccessControlService.isStaff(staff)).toBe(true);
    });
  });

  it('canAccessBranch (WebSocket) includes assigned staff', async () => {
    await expect(service.canAccessBranch(owner, 'b1')).resolves.toBe(true);
    await expect(service.canAccessBranch(otherClient, 'b1')).resolves.toBe(
      false,
    );
    await expect(withAssignedStaff.canAccessBranch(staff, 'b1')).resolves.toBe(
      true,
    );
    await expect(service.canAccessBranch(staff, 'b1')).resolves.toBe(false);
  });
});
