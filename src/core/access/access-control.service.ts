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
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { CashierNotification } from '@/modules/messages/entities/cashier-notifications.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';

interface AccessUser {
  id: string;
  roles: UserRoles[];
}

/**
 * Punto único para decidir si un usuario puede operar sobre los datos de un
 * restaurante (y todo lo que cuelga de él: sucursales, menús, pedidos,
 * notificaciones...).
 *
 * - SUPER y ADMIN: acceso a todos los restaurantes.
 * - CLIENT: solo a los restaurantes de los que es dueño (restaurants.userId).
 * - USER: hoy no está vinculado a ningún restaurante, así que no tiene acceso
 *   a datos de restaurantes.
 */
@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  static isPrivileged(user: AccessUser): boolean {
    return (
      user.roles?.some(
        (role) => role === UserRoles.SUPER || role === UserRoles.ADMIN,
      ) ?? false
    );
  }

  async assertRestaurantAccess(
    user: AccessUser,
    restaurantId: string,
  ): Promise<void> {
    const ownerId = await this.dataSource
      .getRepository(Restaurant)
      .createQueryBuilder('restaurant')
      .select('restaurant.userId', 'ownerId')
      .where('restaurant.id = :restaurantId', { restaurantId })
      .getRawOne<{ ownerId: string }>();

    this.assertOwnership(user, ownerId?.ownerId, 'restaurant', restaurantId);
  }

  async assertBranchAccess(user: AccessUser, branchId: string): Promise<void> {
    const row = await this.dataSource
      .getRepository(Branch)
      .createQueryBuilder('branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .where('branch.id = :branchId', { branchId })
      .getRawOne<{ ownerId: string }>();

    this.assertOwnership(user, row?.ownerId, 'branch', branchId);
  }

  /**
   * Verifica que la sucursal pertenezca al restaurante indicado en la ruta y
   * que el usuario tenga acceso a ese restaurante.
   */
  async assertBranchInRestaurant(
    user: AccessUser,
    restaurantId: string,
    branchId: string,
  ): Promise<void> {
    const row = await this.dataSource
      .getRepository(Branch)
      .createQueryBuilder('branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .where('branch.id = :branchId AND restaurant.id = :restaurantId', {
        branchId,
        restaurantId,
      })
      .getRawOne<{ ownerId: string }>();

    this.assertOwnership(user, row?.ownerId, 'branch', branchId);
  }

  async assertMenuAccess(user: AccessUser, menuId: string): Promise<void> {
    const row = await this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .innerJoin('menu.branch', 'branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .where('menu.id = :menuId', { menuId })
      .getRawOne<{ ownerId: string }>();

    this.assertOwnership(user, row?.ownerId, 'menu', menuId);
  }

  async assertOrderAccess(user: AccessUser, orderId: string): Promise<void> {
    const row = await this.dataSource
      .getRepository(Order)
      .createQueryBuilder('order')
      .innerJoin('order.branch', 'branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .where('order.id = :orderId', { orderId })
      .getRawOne<{ ownerId: string }>();

    this.assertOwnership(user, row?.ownerId, 'order', orderId);
  }

  async assertNotificationAccess(
    user: AccessUser,
    notificationId: string,
  ): Promise<void> {
    const row = await this.dataSource
      .getRepository(CashierNotification)
      .createQueryBuilder('notification')
      .innerJoin('notification.branch', 'branch')
      .innerJoin('branch.restaurant', 'restaurant')
      .select('restaurant.userId', 'ownerId')
      .where('notification.id = :notificationId', { notificationId })
      .getRawOne<{ ownerId: string }>();

    this.assertOwnership(user, row?.ownerId, 'notification', notificationId);
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

  async canAccessBranch(user: AccessUser, branchId: string): Promise<boolean> {
    try {
      await this.assertBranchAccess(user, branchId);
      return true;
    } catch {
      return false;
    }
  }

  private assertOwnership(
    user: AccessUser,
    ownerId: string | undefined,
    resource: string,
    resourceId: string,
  ): void {
    if (!ownerId) throw new NotFoundException(`${resource} not found`);

    if (AccessControlService.isPrivileged(user)) return;

    if (user.roles?.includes(UserRoles.CLIENT) && ownerId === user.id) return;

    this.logger.warn(
      `User ${user.id} denied access to ${resource} ${resourceId}`,
    );
    throw new ForbiddenException('You do not have access to this resource');
  }
}
