import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Category } from '@/modules/categories/entities/category.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { CashierNotification } from '@/modules/notifications/entities/cashier-notifications.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { User } from '@/modules/users/entities/user.entity';

const PASSWORD = 'Sup3r-secret!';
const ASSISTANT_PHONE = '+5215511110001';
const RECEPTION_PHONE = '+5215511110002';
const CUSTOMER_PHONE = '+5215522220001';

interface Seed {
  superUser: User;
  clientA: User;
  clientB: User;
  restaurantA: Restaurant;
  branchA: Branch;
  restaurantB: Restaurant;
  branchB: Branch;
  customer: Customer;
  menuItem: MenuItem;
  notification: CashierNotification;
}

describe('BotBite API (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let seed: Seed;
  let baseUrl: string;

  const http = () => request(app.getHttpServer());

  const login = async (email: string) => {
    const res = await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
    return res.body as { access_token: string; refresh_token: string };
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Reutiliza la sesión: el login está limitado a 20 por minuto por IP. */
  const sessions = new Map<string, string>();
  const tokenFor = async (email: string) => {
    if (!sessions.has(email)) {
      sessions.set(email, (await login(email)).access_token);
    }
    return sessions.get(email)!;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: ['error'],
    });
    configureApp(app);

    dataSource = app.get(DataSource);
    await dataSource.dropDatabase();
    await dataSource.runMigrations();

    await app.listen(0);
    baseUrl = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;

    seed = await seedData(dataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('auth', () => {
    it('returns the same error for unknown emails and wrong passwords', async () => {
      const unknown = await http()
        .post('/v1/auth/login')
        .send({ email: 'nobody@botbite.test', password: 'whatever1' })
        .expect(400);
      const wrong = await http()
        .post('/v1/auth/login')
        .send({ email: seed.clientA.email, password: 'wrong-password' })
        .expect(400);

      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('rotates refresh tokens and revokes the session when an old one is reused', async () => {
      const { refresh_token } = await login(seed.clientA.email);

      const first = await http()
        .post('/v1/auth/refresh-token')
        .send({ refreshToken: refresh_token })
        .expect(201);
      expect(first.body.accessToken).toBe(first.body.access_token);

      // Reutilizar el token ya rotado: se asume robo.
      await http()
        .post('/v1/auth/refresh-token')
        .send({ refreshToken: refresh_token })
        .expect(401);

      // ...y la sesión completa queda revocada.
      await http()
        .post('/v1/auth/refresh-token')
        .send({ refreshToken: first.body.refresh_token })
        .expect(401);
    });

    it('does not accept a refresh token as access token', async () => {
      const { refresh_token } = await login(seed.clientA.email);
      await http()
        .get('/v1/auth/validate-token')
        .set(auth(refresh_token))
        .expect(401);
    });

    it('logout revokes the refresh token', async () => {
      const { refresh_token } = await login(seed.clientA.email);
      await http()
        .post('/v1/auth/logout')
        .send({ refreshToken: refresh_token })
        .expect(204);
      await http()
        .post('/v1/auth/refresh-token')
        .send({ refreshToken: refresh_token })
        .expect(401);
    });
  });

  describe('users', () => {
    it('never returns password hashes and registers new users (broken in v1)', async () => {
      const { access_token } = await login(seed.superUser.email);

      const res = await http()
        .post('/v1/users/register-client')
        .set(auth(access_token))
        .send({ email: 'New.Client@Botbite.test', password: 'a-strong-pass' })
        .expect(201);

      expect(res.body.user.email).toBe('new.client@botbite.test');
      expect(JSON.stringify(res.body)).not.toContain('password');
      expect(JSON.stringify(res.body)).not.toContain('$argon2');
    });

    it('clients cannot list users', async () => {
      const { access_token } = await login(seed.clientA.email);
      await http().get('/v1/users').set(auth(access_token)).expect(403);
    });
  });

  describe('multi-tenant access', () => {
    it('a client can see its own branches but not another restaurant', async () => {
      const { access_token } = await login(seed.clientB.email);

      await http()
        .get(`/v1/branches/restaurant/${seed.restaurantB.id}`)
        .set(auth(access_token))
        .expect(200);

      await http()
        .get(`/v1/branches/restaurant/${seed.restaurantA.id}`)
        .set(auth(access_token))
        .expect(403);

      await http()
        .get(`/v1/orders?branchId=${seed.branchA.id}`)
        .set(auth(access_token))
        .expect(403);

      await http()
        .get(`/v1/messages/conversations?branchId=${seed.branchA.id}`)
        .set(auth(access_token))
        .expect(403);
    });

    it('no longer accepts message credits', async () => {
      const { access_token } = await login(seed.superUser.email);
      await http()
        .patch(
          `/v1/branches/restaurant/${seed.restaurantA.id}/${seed.branchA.id}`,
        )
        .set(auth(access_token))
        .send({ availableMessages: 5 })
        .expect(400);
    });

    it('a branch id from another restaurant is not found through this restaurant', async () => {
      const { access_token } = await login(seed.superUser.email);
      await http()
        .get(
          `/v1/branches/restaurant/${seed.restaurantB.id}/${seed.branchA.id}`,
        )
        .set(auth(access_token))
        .expect(404);
    });

    it('deactivating a branch works (always failed in v1)', async () => {
      const { access_token } = await login(seed.superUser.email);
      await http()
        .delete(`/v1/branches/${seed.restaurantB.id}/${seed.branchB.id}`)
        .set(auth(access_token))
        .expect(200);
    });
  });

  describe('staff (cashiers and waiters)', () => {
    const STAFF_EMAIL = 'cajero@botbite.test';
    let staffToken: string;
    let staffId: string;

    beforeAll(async () => {
      const admin = await login(seed.superUser.email);
      const res = await http()
        .post('/v1/users/register-user')
        .set(auth(admin.access_token))
        .send({ email: STAFF_EMAIL, password: PASSWORD })
        .expect(201);
      staffId = res.body.user.id;
    });

    const staffUrl = () =>
      `/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/staff`;

    it('has no access before being assigned to a branch', async () => {
      staffToken = (await login(STAFF_EMAIL)).access_token;

      const restaurants = await http()
        .get('/v1/restaurants')
        .set(auth(staffToken))
        .expect(200);
      expect(restaurants.body.restaurants).toHaveLength(0);

      await http()
        .get(`/v1/orders?branchId=${seed.branchA.id}`)
        .set(auth(staffToken))
        .expect(403);
    });

    it('only the branch owner (or an admin) can assign staff', async () => {
      const otherClient = await login(seed.clientB.email);
      await http()
        .post(staffUrl())
        .set(auth(otherClient.access_token))
        .send({ email: STAFF_EMAIL })
        .expect(403);

      // Solo cuentas de personal: un cliente no se puede asignar.
      const owner = await login(seed.clientA.email);
      await http()
        .post(staffUrl())
        .set(auth(owner.access_token))
        .send({ email: seed.clientB.email })
        .expect(404);

      await http()
        .post(staffUrl())
        .set(auth(owner.access_token))
        .send({ email: STAFF_EMAIL })
        .expect(201);

      const list = await http()
        .get(staffUrl())
        .set(auth(owner.access_token))
        .expect(200);
      expect(list.body.staff.map((s: { email: string }) => s.email)).toEqual([
        STAFF_EMAIL,
      ]);
    });

    it('reads restaurants, branches, orders and notifications of its branch only', async () => {
      const restaurants = await http()
        .get('/v1/restaurants')
        .set(auth(staffToken))
        .expect(200);
      expect(
        restaurants.body.restaurants.map((r: { id: string }) => r.id),
      ).toEqual([seed.restaurantA.id]);

      const branches = await http()
        .get(`/v1/branches/restaurant/${seed.restaurantA.id}`)
        .set(auth(staffToken))
        .expect(200);
      expect(branches.body.branches.map((b: { id: string }) => b.id)).toEqual([
        seed.branchA.id,
      ]);

      await http()
        .get(`/v1/orders?branchId=${seed.branchA.id}`)
        .set(auth(staffToken))
        .expect(200);
      await http()
        .get(`/v1/notifications?branchId=${seed.branchA.id}`)
        .set(auth(staffToken))
        .expect(200);

      await http()
        .get(`/v1/orders?branchId=${seed.branchB.id}`)
        .set(auth(staffToken))
        .expect(403);
      await http()
        .get(`/v1/branches/restaurant/${seed.restaurantB.id}`)
        .set(auth(staffToken))
        .expect(403);
    });

    it('cannot modify anything', async () => {
      await http()
        .patch(
          `/v1/branches/restaurant/${seed.restaurantA.id}/${seed.branchA.id}`,
        )
        .set(auth(staffToken))
        .send({ name: 'Hackeada' })
        .expect(403);
      await http()
        .get(`/v1/menus/${seed.branchA.id}`)
        .set(auth(staffToken))
        .expect(403);
      await http()
        .post(staffUrl())
        .set(auth(staffToken))
        .send({ email: STAFF_EMAIL })
        .expect(403);
    });

    it('loses access when removed from the branch', async () => {
      const owner = await login(seed.clientA.email);
      await http()
        .delete(`${staffUrl()}/${staffId}`)
        .set(auth(owner.access_token))
        .expect(204);

      await http()
        .get(`/v1/orders?branchId=${seed.branchA.id}`)
        .set(auth(staffToken))
        .expect(403);
    });
  });

  describe('orders', () => {
    it('creates an order with its items', async () => {
      const token = await tokenFor(seed.clientA.email);
      const res = await http()
        .post('/v1/orders')
        .set(auth(token))
        .send({
          branchId: seed.branchA.id,
          customerId: seed.customer.id,
          orderItems: [{ menuItemId: seed.menuItem.id, price: 25 }],
        })
        .expect(201);

      expect(Number(res.body.order.total)).toBe(25);
    });
  });

  describe('notifications', () => {
    const listUrl = () => `/v1/notifications?branchId=${seed.branchA.id}`;
    const itemUrl = (action: string) =>
      `/v1/notifications/${seed.notification.id}/${action}`;

    const activeIds = (body: unknown) =>
      (body as { active: { id: string }[] }).active.map(
        (notification) => notification.id,
      );

    it('lists them only for users with access to the branch', async () => {
      const token = await tokenFor(seed.clientA.email);
      const res = await http().get(listUrl()).set(auth(token)).expect(200);
      expect(activeIds(res.body)).toEqual([seed.notification.id]);

      const otherToken = await tokenFor(seed.clientB.email);
      await http().get(listUrl()).set(auth(otherToken)).expect(403);
    });

    it('marks them as read and unread', async () => {
      const token = await tokenFor(seed.clientA.email);

      await http().patch(itemUrl('read')).set(auth(token)).expect(200);
      const read = await http().get(listUrl()).set(auth(token)).expect(200);
      expect(activeIds(read.body)).toEqual([]);

      await http().patch(itemUrl('unread')).set(auth(token)).expect(200);
      const unread = await http().get(listUrl()).set(auth(token)).expect(200);
      expect(activeIds(unread.body)).toEqual([seed.notification.id]);
    });

    it('another client cannot touch them', async () => {
      const token = await tokenFor(seed.clientB.email);
      await http().patch(itemUrl('read')).set(auth(token)).expect(403);
    });

    it('keeps the previous panel routes while the panel is deployed', async () => {
      const token = await tokenFor(seed.clientA.email);
      const branchQuery = `branchId=${seed.branchA.id}`;

      const notifications = await http()
        .get(`/v1/messages/notifications?${branchQuery}`)
        .set(auth(token))
        .expect(200);
      expect(activeIds(notifications.body)).toEqual([seed.notification.id]);

      const conversations = await http()
        .get(`/v1/messages/conversations?${branchQuery}`)
        .set(auth(token))
        .expect(200);
      expect(conversations.body).toEqual({ conversations: [], total: 0 });

      await http()
        .patch(`/v1/messages/${seed.notification.id}/read`)
        .set(auth(token))
        .expect(200);
      await http()
        .patch(`/v1/messages/${seed.notification.id}/unread`)
        .set(auth(token))
        .expect(200);
    });

    it('the WhatsApp webhook no longer exists', async () => {
      await http().post('/v1/messages/webhook').send({}).expect(404);
    });
  });

  describe('WebSocket', () => {
    const connect = (token?: string) =>
      new Promise<Socket>((resolve, reject) => {
        const socket = io(`${baseUrl}/orders`, {
          transports: ['websocket'],
          auth: token ? { token } : {},
          reconnection: false,
        });
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', (error) => {
          socket.close();
          reject(error);
        });
      });

    it('rejects connections without a token', async () => {
      await expect(connect()).rejects.toThrow('Unauthorized');
    });

    it('only lets users join branches they own', async () => {
      const token = await tokenFor(seed.clientB.email);
      const socket = await connect(token);

      const denied = (await socket.emitWithAck(
        'joinBranch',
        seed.branchA.id,
      )) as {
        success: boolean;
      };
      const allowed = (await socket.emitWithAck(
        'joinBranch',
        seed.branchB.id,
      )) as {
        success: boolean;
      };
      socket.close();

      expect(denied.success).toBe(false);
      expect(allowed.success).toBe(true);
    });

    it('pushes notification changes to the branch room', async () => {
      const token = await tokenFor(seed.clientA.email);
      const socket = await connect(token);
      await socket.emitWithAck('joinBranch', seed.branchA.id);

      const received = new Promise<{ branchId: string }>((resolve) => {
        socket.once('notificationUpdate', resolve);
      });
      await http()
        .patch(`/v1/notifications/${seed.notification.id}/read`)
        .set(auth(token))
        .expect(200);

      await expect(received).resolves.toMatchObject({
        branchId: seed.branchA.id,
      });
      socket.close();
    });
  });
});

async function seedData(dataSource: DataSource): Promise<Seed> {
  const password = await argon2.hash(PASSWORD);
  const users = dataSource.getRepository(User);

  const [superUser, clientA, clientB] = await users.save([
    users.create({
      email: 'super@botbite.test',
      password,
      roles: [UserRoles.SUPER],
    }),
    users.create({
      email: 'client.a@botbite.test',
      password,
      roles: [UserRoles.CLIENT],
    }),
    users.create({
      email: 'client.b@botbite.test',
      password,
      roles: [UserRoles.CLIENT],
    }),
  ]);

  const restaurants = dataSource.getRepository(Restaurant);
  const [restaurantA, restaurantB] = await restaurants.save([
    restaurants.create({ name: 'Tacos A', userId: clientA.id }),
    restaurants.create({ name: 'Tacos B', userId: clientB.id }),
  ]);

  const branches = dataSource.getRepository(Branch);
  const [branchA, branchB] = await branches.save([
    branches.create({
      name: 'Centro',
      address: 'Calle 1',
      restaurantId: restaurantA.id,
      phoneNumberAssistant: ASSISTANT_PHONE,
      phoneNumberReception: RECEPTION_PHONE,
    }),
    branches.create({
      name: 'Norte',
      address: 'Calle 2',
      restaurantId: restaurantB.id,
    }),
  ]);

  const category = await dataSource
    .getRepository(Category)
    .save({ name: 'Tacos' });
  const product = await dataSource
    .getRepository(Product)
    .save(
      dataSource
        .getRepository(Product)
        .create({ name: 'Taco al pastor', restaurantId: restaurantA.id }),
    );
  const menu = await dataSource
    .getRepository(Menu)
    .save({ name: 'Principal', branchId: branchA.id });
  const menuItem = await dataSource.getRepository(MenuItem).save({
    menuId: menu.id,
    productId: product.id,
    categoryId: category.id,
    price: 25,
  });

  const customer = await dataSource
    .getRepository(Customer)
    .save({ name: 'Ana', phone: CUSTOMER_PHONE });
  const notification = await dataSource
    .getRepository(CashierNotification)
    .save({
      branchId: branchA.id,
      phoneNumber: customer.phone,
      message: 'La mesa 4 pidió la cuenta',
    });

  return {
    superUser,
    clientA,
    clientB,
    restaurantA,
    branchA,
    restaurantB,
    branchB,
    customer,
    menuItem,
    notification,
  };
}
