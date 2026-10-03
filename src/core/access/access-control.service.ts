import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { BranchStaff } from '@/modules/branches/entities/branch-staff.entity';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { CashierNotification } from '@/modules/messages/entities/cashier-notifications.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';

export interface AccessUser {
  id: string;
  roles: UserRoles[];
}

/** Datos de pertenencia de un recurso. */
interface Tenancy {
  ownerId: string;
  restaurantId: string;
  branchId: string | null;
}

/**
 * Qué puede hacer el personal (USER) con un recurso:
 * - 'branch': si está asignado a la sucursal del recurso.
 * - 'restaurant': si está asignado a alguna sucursal del restaurante.
 * - 'none' (por defecto): nunca.
 */
export type StaffScope = 'branch' | 'restaurant' | 'none';

/**
 * Punto único para decidir si un usuario puede operar sobre los datos de un
 * restaurante (y todo lo que cuelga de él: sucursales, menús, pedidos,
 * notificaciones...).
 *
 * - SUPER y ADMIN: acceso a todos los restaurantes.
 * - CLIENT: solo a los restaurantes de los que es dueño (restaurants.userId).
 * - USER (cajeros/meseros): solo a las sucursales que tiene asignadas en
 *   branch_staff, y solo en las rutas que lo permiten explícitamente con
 *   `staffScope`. Por defecto el personal no tiene acceso, así que agregar
 *   el rol USER a una ruta de escritura no basta para abrirla.
 */
@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  static isPrivileged(user: Pick<AccessUser, 'roles'>): boolean {
    return (
      user.roles?.some(
        (role) => role === UserRoles.SUPER || role === UserRoles.ADMIN,
      ) ?? false
    );
  }

  /** Personal de sucursal: rol USER sin ningún rol superior. */
  static isStaff(user: Pick<AccessUser, 'roles'>): boolean {
    const roles = user.roles ?? [];
    return (
      roles.includes(UserRoles.USER) &&
      !roles.includes(UserRoles.CLIENT) &&
      !AccessControlService.isPrivileged(user)
    );
  }

  async assertRestaurantAccess(
    user: AccessUser,
    restaurantId: string,
    staffScope: StaffScope = 'none',
  ): Promise<void> {
    const row = await this.dataSource
      .getRepository(Restaurant)
      .createQueryBuilder('restaurant')
      .select('restaurant.userId', 'ownerId')
      .addSelect('restaurant.id', 'restaurantId')
      .where('restaurant.id = :restaurantId', { restaurantId })
      .getRawOne<Tenancy>();

    await this.assertTenancy(
      user,
      row && { ...row, branchId: null },
      staffScope,
      'restaurant',
      restaurantId,
    );
  }

  async assertBranchAccess(
    user: AccessUser,
    branchId: string,
    staffScope: StaffScope = 'none',
  ): Promise<void> {
    const row = await this.branchTenancy()
      .where('branch.id = :branchId', { branchId })
      .getRawOne<Tenancy>();

    await this.assertTenancy(user, row, staffScope, 'branch', branchId);
  }

  /**
   * Verifica que la sucursal pertenezca al restaurante indicado en la ruta y
   * que el usuario tenga acceso a ella.
   */
  async assertBranchInRestaurant(
    user: AccessUser,
    restaurantId: string,
    branchId: string,
    staffScope: StaffScope = 'none',
  ): Promise<void> {
    const row = await this.branchTenancy()
      .where('branch.id = :branchId AND restaurant.id = :restaurantId', {
        branchId,
        restaurantId,
      })
      .getRawOne<Tenancy>();

    await this.assertTenancy(user, row, staffScope, 'branch', branchId);
  }

  async assertMenuAccess(user: AccessUser, menuId: string): Promise<void> {
    const row = await this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .innerJoin('menu.branch', 'branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .addSelect('restaurant.id', 'restaurantId')
      .addSelect('branch.id', 'branchId')
      .where('menu.id = :menuId', { menuId })
      .getRawOne<Tenancy>();

    // El personal no administra menús.
    await this.assertTenancy(user, row, 'none', 'menu', menuId);
  }

  async assertOrderAccess(
    user: AccessUser,
    orderId: string,
    staffScope: StaffScope = 'none',
  ): Promise<void> {
    const row = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .innerJoin('order.branch', 'branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .addSelect('restaurant.id', 'restaurantId')
      .addSelect('branch.id', 'branchId')
      .where('order.id = :orderId', { orderId })
      .getRawOne<Tenancy>();

    await this.assertTenancy(user, row, staffScope, 'order', orderId);
  }

  async assertNotificationAccess(
    user: AccessUser,
    notificationId: string,
    staffScope: StaffScope = 'none',
  ): Promise<void> {
    const row = await this.dataSource
      .getRepository(CashierNotification)
      .createQueryBuilder('notification')
      .innerJoin('notification.branch', 'branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .addSelect('restaurant.id', 'restaurantId')
      .addSelect('branch.id', 'branchId')
      .where('notification.id = :notificationId', { notificationId })
      .getRawOne<Tenancy>();

    await this.assertTenancy(
      user,
      row,
      staffScope,
      'notification',
      notificationId,
    );
  }

  /**
   * Un item de menú solo puede apuntar a productos del mismo restaurante que
   * el menú.
   */
  async assertProductBelongsToMenuRestaurant(
    menuId: string,
    productId: string,
  ): Promise<void> {
    const exists = await this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .innerJoin('menu.branch', 'branch')
      .innerJoin(
        Product,
        'product',
        'product.restaurantId = branch.restaurantId',
      )
      .where('menu.id = :menuId AND product.id = :productId', {
        menuId,
        productId,
      })
      .getExists();

    if (!exists)
      throw new BadRequestException(
        'The product does not belong to this restaurant',
      );
  }

  /** Para el WebSocket: el personal puede escuchar sus sucursales. */
  async canAccessBranch(user: AccessUser, branchId: string): Promise<boolean> {
    try {
      await this.assertBranchAccess(user, branchId, 'branch');
      return true;
    } catch {
      return false;
    }
  }

  /** IDs de las sucursales asignadas a un miembro del personal. */
  async getStaffBranchIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource
      .getRepository(BranchStaff)
      .find({ where: { userId }, select: { branchId: true } });
    return rows.map((row) => row.branchId);
  }

  /** IDs de los restaurantes donde un miembro del personal tiene sucursales. */
  async getStaffRestaurantIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource
      .getRepository(BranchStaff)
      .createQueryBuilder('staff')
      .innerJoin('staff.branch', 'branch')
      .select('DISTINCT branch.restaurantId', 'restaurantId')
      .where('staff.userId = :userId', { userId })
      .getRawMany<{ restaurantId: string }>();
    return rows.map((row) => row.restaurantId);
  }

  private branchTenancy() {
    return this.dataSource
      .getRepository(Branch)
      .createQueryBuilder('branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .addSelect('restaurant.id', 'restaurantId')
      .addSelect('branch.id', 'branchId');
  }

  private async assertTenancy(
    user: AccessUser,
    tenancy: Tenancy | undefined,
    staffScope: StaffScope,
    resource: string,
    resourceId: string,
  ): Promise<void> {
    if (!tenancy?.ownerId) throw new NotFoundException(`${resource} not found`);

    if (AccessControlService.isPrivileged(user)) return;

    if (user.roles?.includes(UserRoles.CLIENT) && tenancy.ownerId === user.id) {
      return;
    }

    if (
      AccessControlService.isStaff(user) &&
      (await this.isStaffAllowed(user.id, tenancy, staffScope))
    ) {
      return;
    }

    this.logger.warn(
      `User ${user.id} denied access to ${resource} ${resourceId}`,
    );
    throw new ForbiddenException('You do not have access to this resource');
  }

  private isStaffAllowed(
    userId: string,
    tenancy: Tenancy,
    staffScope: StaffScope,
  ): Promise<boolean> {
    if (staffScope === 'none') return Promise.resolve(false);

    const query = this.dataSource
      .getRepository(BranchStaff)
      .createQueryBuilder('staff')
      .where('staff.userId = :userId', { userId });

    if (staffScope === 'branch') {
      if (!tenancy.branchId) return Promise.resolve(false);
      query.andWhere('staff.branchId = :branchId', {
        branchId: tenancy.branchId,
      });
    } else {
      query
        .innerJoin('staff.branch', 'branch')
        .andWhere('branch.restaurantId = :restaurantId', {
          restaurantId: tenancy.restaurantId,
        });
    }

    return query.getExists();
  }
}
