import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { DataSource, Like } from 'typeorm';
import {
  BotEventsService,
  signBotEvent,
} from '@/modules/bot-events/bot-events.service';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Category } from '@/modules/categories/entities/category.entity';
import { AuditLog } from '@/modules/audit/entities/audit-log.entity';
import { CustomerTaxProfile } from '@/modules/customers/entities/customer-tax-profile.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { RestaurantCustomer } from '@/modules/customers/entities/restaurant-customer.entity';
import { WalletMovement } from '@/modules/customers/entities/wallet-movement.entity';
import {
  PromosStatus,
  WalletMovementType,
} from '@/modules/customers/enums/customer.enums';
import { CustomerReportService } from '@/modules/customers/services/customer-report.service';
import { MenuPhotoService } from '@/modules/menus/csv/menu-photo.service';
import { RestaurantLogoStorage } from '@/modules/restaurants/restaurant-logo.storage';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { CashierNotification } from '@/modules/notifications/entities/cashier-notifications.entity';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { Invoice } from '@/modules/orders/entities/invoice.entity';
import { OrderItem } from '@/modules/orders/entities/order-item.entity';
import { OrderRound } from '@/modules/orders/entities/order-round.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import {
  FulfillmentStatus,
  OrderStatus,
  OrderType,
  RoundStatus,
} from '@/modules/orders/enums/order.enums';
import { OrderingPrivacyService } from '@/modules/orders/services/ordering-privacy.service';
import { BranchOrdering } from '@/modules/ordering/entities/branch-ordering.entity';
import { Payment } from '@/modules/orders/entities/payment.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { User } from '@/modules/users/entities/user.entity';

const PASSWORD = 'Sup3r-secret!';
const ASSISTANT_PHONE = '+5215511110001';
const RECEPTION_PHONE = '+5215511110002';
const CUSTOMER_PHONE = '+5215522220001';

/** El logo no sale a Cloudinary. */
const fakeLogoStorage = {
  upload: (_image: Buffer, restaurantId: string) =>
    Promise.resolve(
      `https://res.cloudinary.com/e2e/image/upload/restaurants/${restaurantId}/logo.png`,
    ),
};

/** Las fotos del CSV no salen a Cloudinary; "rota" simula una que no se copia. */
const fakeMenuPhotos = {
  isOwnUrl: (url: string) => url.startsWith('https://res.cloudinary.com/e2e/'),
  copy: (url: string, restaurantId: string, productId: string) =>
    url.includes('rota')
      ? Promise.reject(new Error('Resource not found'))
      : Promise.resolve(
          `https://res.cloudinary.com/e2e/image/upload/products/${restaurantId}/product-${productId}.jpg`,
        ),
};

interface Seed {
  superUser: User;
  clientA: User;
  clientB: User;
  restaurantA: Restaurant;
  branchA: Branch;
  restaurantB: Restaurant;
  branchB: Branch;
  customer: Customer;
  category: Category;
  menu: Menu;
  menuItem: MenuItem;
  foreignMenuItem: MenuItem;
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
    })
      .overrideProvider(MenuPhotoService)
      .useValue(fakeMenuPhotos)
      .overrideProvider(RestaurantLogoStorage)
      .useValue(fakeLogoStorage)
      .compile();

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

      const own = await http()
        .get(`/v1/branches/restaurant/${seed.restaurantB.id}`)
        .set(auth(access_token))
        .expect(200);
      // El panel marca la verificación de ubicación y fija el prefijo del slug.
      expect(own.body.branches[0]).toMatchObject({
        verifyLocation: false,
        restaurant: { slug: seed.restaurantB.slug },
      });

      await http()
        .get(`/v1/branches/restaurant/${seed.restaurantA.id}`)
        .set(auth(access_token))
        .expect(403);

      await http()
        .get(`/v1/orders?branchId=${seed.branchA.id}`)
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

      await http()
        .get(`/v1/categories?restaurantId=${seed.restaurantA.id}`)
        .set(auth(staffToken))
        .expect(200);
      await http()
        .get(`/v1/categories?restaurantId=${seed.restaurantB.id}`)
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

  describe('categories', () => {
    const createCategory = async (
      token: string,
      restaurantId: string,
      name: string,
    ) =>
      http()
        .post('/v1/categories')
        .set(auth(token))
        .send({ restaurantId, name });

    it('the owner creates them; another client cannot', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const other = await tokenFor(seed.clientB.email);

      const created = await createCategory(
        owner,
        seed.restaurantA.id,
        'bebidas',
      );
      expect(created.status).toBe(201);
      expect(created.body.category.name).toBe('BEBIDAS');

      const denied = await createCategory(
        other,
        seed.restaurantA.id,
        'POSTRES',
      );
      expect(denied.status).toBe(403);
    });

    it('the name repeats between restaurants, not inside one', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const other = await tokenFor(seed.clientB.email);

      const same = await createCategory(owner, seed.restaurantA.id, 'BEBIDAS');
      expect(same.status).toBe(409);

      const elsewhere = await createCategory(
        other,
        seed.restaurantB.id,
        'BEBIDAS',
      );
      expect(elsewhere.status).toBe(201);
    });

    it('each restaurant only lists its own', async () => {
      const owner = await tokenFor(seed.clientA.email);

      await http().get('/v1/categories').set(auth(owner)).expect(400);

      const list = await http()
        .get(`/v1/categories?restaurantId=${seed.restaurantA.id}`)
        .set(auth(owner))
        .expect(200);
      expect(list.body.categories.map((c: { name: string }) => c.name)).toEqual(
        expect.arrayContaining(['BEBIDAS', 'TACOS']),
      );
      expect(
        list.body.categories.every(
          (c: { restaurantId: string }) =>
            c.restaurantId === seed.restaurantA.id,
        ),
      ).toBe(true);

      await http()
        .get(`/v1/categories?restaurantId=${seed.restaurantB.id}`)
        .set(auth(owner))
        .expect(403);
    });

    it('another client cannot edit or remove them', async () => {
      const other = await tokenFor(seed.clientB.email);
      const url = `/v1/categories/${seed.category.id}`;

      await http().get(url).set(auth(other)).expect(403);
      await http()
        .patch(url)
        .set(auth(other))
        .send({ name: 'HACKEADA' })
        .expect(403);
      await http().delete(url).set(auth(other)).expect(403);
    });

    it('cannot be moved to another restaurant', async () => {
      const owner = await tokenFor(seed.clientA.email);
      await http()
        .patch(`/v1/categories/${seed.category.id}`)
        .set(auth(owner))
        .send({ restaurantId: seed.restaurantB.id })
        .expect(400);
    });

    it('a menu item cannot use a category of another restaurant', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const other = await tokenFor(seed.clientB.email);
      const foreign = await createCategory(other, seed.restaurantB.id, 'AJENA');

      await http()
        .patch(`/v1/menus/menu/${seed.menu.id}/items/${seed.menuItem.id}`)
        .set(auth(owner))
        .send({ categoryId: foreign.body.category.id })
        .expect(400);
    });
  });

  describe('slugs', () => {
    it('new branches get a unique slug', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const create = () =>
        http()
          .post(`/v1/branches/${seed.restaurantA.id}`)
          .set(auth(owner))
          .send({ name: 'Plaza Ñandú', address: 'Calle 3' })
          .expect(201);

      // Estándar <restaurante>-<sucursal>: único aunque otro restaurante
      // tenga una sucursal con el mismo nombre.
      expect((await create()).body.branch.slug).toBe(
        'restaurante-a-plaza-nandu',
      );
      expect((await create()).body.branch.slug).toBe(
        'restaurante-a-plaza-nandu-2',
      );
    });

    it('new restaurants get a slug', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const res = await http()
        .post('/v1/restaurants')
        .set(auth(owner))
        .send({ name: 'Punto de Unión' })
        .expect(201);

      expect(res.body.restaurant.slug).toBe('punto-de-union');
    });

    it('an apostrophe does not split the slug', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const res = await http()
        .post('/v1/restaurants')
        .set(auth(owner))
        .send({ name: "Sushilito's" })
        .expect(201);

      expect(res.body.restaurant.slug).toBe('sushilitos');
    });

    it('the owner sets the wallet percentage, only an admin the slug', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const admin = await tokenFor(seed.superUser.email);
      const url = `/v1/restaurants/${seed.restaurantA.id}`;

      await http()
        .patch(url)
        .set(auth(owner))
        .send({ walletPct: 7.5 })
        .expect(200);
      await http()
        .patch(url)
        .set(auth(owner))
        .send({ slug: 'otro-slug' })
        .expect(403);
      await http()
        .patch(url)
        .set(auth(admin))
        .send({ slug: 'tacos-a' })
        .expect(200);
    });
  });

  describe('bot configuration', () => {
    const configUrl = () =>
      `/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/bot-config`;

    it('the owner edits the daily operation', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const res = await http()
        .patch(configUrl())
        .set(auth(owner))
        .send({
          latitude: 27.535038,
          longitude: -109.954031,
          verifyLocation: true,
          geofenceMeters: 200,
          dailyCloseTime: '22:15',
          validTables: [' 1 ', 'A3', 'A3', ''],
          surveyUrl: 'https://forms.gle/abc',
        })
        .expect(200);

      expect(res.body.config).toMatchObject({
        latitude: 27.535038,
        longitude: -109.954031,
        verifyLocation: true,
        dailyCloseTime: '22:15',
        validTables: ['1', 'A3'],
      });
    });

    it('location needs coordinates', async () => {
      const owner = await tokenFor(seed.clientA.email);
      await http()
        .patch(configUrl())
        .set(auth(owner))
        .send({ latitude: null })
        .expect(400);
    });

    it('rounds the coordinates as Google Maps copies them', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const res = await http()
        .patch(configUrl())
        .set(auth(owner))
        .send({ latitude: 27.5350381, longitude: '-109.9540312' })
        .expect(200);

      expect(res.body.config).toMatchObject({
        latitude: 27.535038,
        longitude: -109.954031,
      });

      await http()
        .patch(configUrl())
        .set(auth(owner))
        .send({ latitude: 'norte' })
        .expect(400);
    });

    it('notifies the bot when the configuration, the branch or the restaurant is saved', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const events = jest.spyOn(app.get(BotEventsService), 'catalogChanged');

      await http()
        .patch(configUrl())
        .set(auth(owner))
        .send({ geofenceMeters: 150 })
        .expect(200);
      expect(events).toHaveBeenLastCalledWith(
        expect.objectContaining({ branchId: seed.branchA.id }),
      );

      await http()
        .patch(
          `/v1/branches/restaurant/${seed.restaurantA.id}/${seed.branchA.id}`,
        )
        .set(auth(owner))
        .send({ address: 'Calle 1 #10' })
        .expect(200);
      expect(events).toHaveBeenLastCalledWith(
        expect.objectContaining({ branchId: seed.branchA.id }),
      );

      await http()
        .patch(`/v1/restaurants/${seed.restaurantA.id}`)
        .set(auth(owner))
        .send({ name: 'Tacos A' })
        .expect(200);
      expect(events).toHaveBeenLastCalledWith({
        branchId: undefined,
        menuId: undefined,
        restaurantId: seed.restaurantA.id,
        categoryId: undefined,
      });

      // Un cambio que falla no avisa.
      const calls = events.mock.calls.length;
      await http()
        .patch(configUrl())
        .set(auth(owner))
        .send({ geofenceMeters: 1 })
        .expect(400);
      expect(events).toHaveBeenCalledTimes(calls);
      events.mockRestore();
    });

    it('only an admin changes what connects to n8n or what was contracted', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const admin = await tokenFor(seed.superUser.email);

      for (const body of [
        { features: { wallet: false } },
        { slug: 'otra' },
        { botBaseUrl: 'https://n8n.test/webhook/x' },
        { whatsappPhoneNumberId: '1439262192594415' },
      ]) {
        await http().patch(configUrl()).set(auth(owner)).send(body).expect(403);
      }

      const res = await http()
        .patch(configUrl())
        .set(auth(admin))
        .send({
          features: { pdfMenu: true },
          botBaseUrl: 'https://n8n.test/webhook/mesero-centro/',
          whatsappPhoneNumberId: '1439262192594415',
        })
        .expect(200);

      expect(res.body.config.botBaseUrl).toBe(
        'https://n8n.test/webhook/mesero-centro',
      );
      // Los cambios parciales conservan las demás funciones.
      expect(res.body.config.features).toMatchObject({
        pdfMenu: true,
        wallet: true,
      });
    });

    it('rejects values already used by another branch', async () => {
      const admin = await tokenFor(seed.superUser.email);
      const url = `/v1/branches/${seed.restaurantB.id}/${seed.branchB.id}/bot-config`;

      await http()
        .patch(url)
        .set(auth(admin))
        .send({ slug: seed.branchA.slug })
        .expect(409);
      await http()
        .patch(url)
        .set(auth(admin))
        .send({ whatsappPhoneNumberId: '1439262192594415' })
        .expect(409);
    });

    it('keeps branch slugs under their restaurant', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const admin = await tokenFor(seed.superUser.email);
      const created = await http()
        .post(`/v1/branches/${seed.restaurantA.id}`)
        .set(auth(owner))
        .send({ name: 'Cócorit', address: 'Calle 9' })
        .expect(201);
      const { slug: restaurantSlug } = await dataSource
        .getRepository(Restaurant)
        .findOneByOrFail({ id: seed.restaurantA.id });
      const url = `/v1/branches/${seed.restaurantA.id}/${created.body.branch.id}/bot-config`;

      expect(created.body.branch.slug).toBe(`${restaurantSlug}-cocorit`);

      await http()
        .patch(url)
        .set(auth(admin))
        .send({ slug: 'cocorit' })
        .expect(400);
      const renamed = await http()
        .patch(url)
        .set(auth(admin))
        .send({ slug: `${restaurantSlug}-cocorit-centro` })
        .expect(200);
      expect(renamed.body.config.slug).toBe(`${restaurantSlug}-cocorit-centro`);
    });

    it('rejects invalid values', async () => {
      const admin = await tokenFor(seed.superUser.email);

      for (const body of [
        { slug: 'Con Espacios' },
        { dailyCloseTime: '25:00' },
        { timezone: 'Marte/Olympus' },
        { botBaseUrl: 'http://sin-https.test' },
        { features: { desconocida: true } },
        { commissionPct: -1 },
        { commissionPct: 100.5 },
        { commissionPct: 0.555 },
        { hours: [{ days: [7], opens: '13:00', closes: '23:00' }] },
        { hours: [{ days: [], opens: '13:00', closes: '23:00' }] },
        { hours: [{ days: [1], opens: '1pm', closes: '23:00' }] },
      ]) {
        await http().patch(configUrl()).set(auth(admin)).send(body).expect(400);
      }
    });

    it('only an admin changes the BotBite commission of the waiter; the owner sees it', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const admin = await tokenFor(seed.superUser.email);

      const before = await http().get(configUrl()).set(auth(owner)).expect(200);
      expect(before.body.config.commissionPct).toBe(0);

      await http()
        .patch(configUrl())
        .set(auth(owner))
        .send({ commissionPct: 0 })
        .expect(403);

      const res = await http()
        .patch(configUrl())
        .set(auth(admin))
        .send({ commissionPct: 0.5 })
        .expect(200);
      expect(res.body.config.commissionPct).toBe(0.5);

      const seen = await http().get(configUrl()).set(auth(owner)).expect(200);
      expect(seen.body.config.commissionPct).toBe(0.5);
    });

    it('the owner sets the waiter hours, which can cross midnight', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const hours = [
        { days: [1, 2, 3, 4, 5, 6], opens: '13:00', closes: '01:00' },
        { days: [0], opens: '13:00', closes: '20:00' },
      ];

      const res = await http()
        .patch(configUrl())
        .set(auth(owner))
        .send({ hours })
        .expect(200);
      expect(res.body.config.hours).toEqual(hours);
      // El cierre del día va aparte del horario.
      expect(res.body.config.dailyCloseTime).toBe('22:15');
    });

    it('the time zone is changed in the branch data and serves both modules', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const branchUrl = `/v1/branches/restaurant/${seed.restaurantA.id}/${seed.branchA.id}`;

      await http()
        .patch(branchUrl)
        .set(auth(owner))
        .send({ timezone: 'America/Mexico_City' })
        .expect(200);
      const changed = await http()
        .get(configUrl())
        .set(auth(owner))
        .expect(200);
      expect(changed.body.config.timezone).toBe('America/Mexico_City');
      // La lista la trae: Editar sucursal no debe regresarla a la de por defecto.
      const list = await http()
        .get(`/v1/branches/restaurant/${seed.restaurantA.id}`)
        .set(auth(owner))
        .expect(200);
      const listed = (
        list.body.branches as { id: string; timezone: string }[]
      ).find((branch) => branch.id === seed.branchA.id);
      expect(listed?.timezone).toBe('America/Mexico_City');

      await http()
        .patch(branchUrl)
        .set(auth(owner))
        .send({ timezone: 'Marte/Olympus' })
        .expect(400);
      // Una sucursal del dueño no acepta la comisión por esta ruta.
      await http()
        .patch(branchUrl)
        .set(auth(owner))
        .send({ commissionPct: 0 })
        .expect(400);

      await http()
        .patch(branchUrl)
        .set(auth(owner))
        .send({ timezone: 'America/Hermosillo' })
        .expect(200);
    });

    it('another client cannot read it', async () => {
      const other = await tokenFor(seed.clientB.email);
      await http().get(configUrl()).set(auth(other)).expect(403);
    });
  });

  describe('bot API', () => {
    const BRANCH_URL = '/v1/bot/branch';
    const keysUrl = () =>
      `/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/bot-keys`;
    let secret: string;
    let keyId: string;

    const asBot = (key: string, url = BRANCH_URL) =>
      http().get(url).set('X-BotBite-Key', key);

    it('only an admin manages keys', async () => {
      const owner = await tokenFor(seed.clientA.email);
      await http()
        .post(keysUrl())
        .set(auth(owner))
        .send({ name: 'n8n' })
        .expect(403);
      await http().get(keysUrl()).set(auth(owner)).expect(403);
    });

    it('shows the key once and never stores it in clear', async () => {
      const admin = await tokenFor(seed.superUser.email);
      const created = await http()
        .post(keysUrl())
        .set(auth(admin))
        .send({ name: 'n8n Cocorit' })
        .expect(201);

      secret = created.body.secret;
      keyId = created.body.key.id;
      expect(secret).toMatch(/^bbk_[a-f0-9]{8}_/);

      const list = await http().get(keysUrl()).set(auth(admin)).expect(200);
      expect(JSON.stringify(list.body)).not.toContain(secret);
      expect(list.body.keys[0]).not.toHaveProperty('keyHash');
      expect(list.body.keys[0]).toMatchObject({
        id: keyId,
        name: 'n8n Cocorit',
        keyPrefix: secret.slice(0, 12),
        revokedAt: null,
      });
    });

    it('rejects requests without a valid key', async () => {
      await http().get(BRANCH_URL).expect(401);
      await asBot('bbk_00000000_invalida').expect(401);

      // Una sesión del panel tampoco sirve.
      const admin = await tokenFor(seed.superUser.email);
      await http().get(BRANCH_URL).set(auth(admin)).expect(401);
    });

    it('a key only opens the bot routes', async () => {
      await asBot(secret, `/v1/orders?branchId=${seed.branchA.id}`).expect(401);
    });

    it('returns the configuration and the catalog of the key branch', async () => {
      const res = await asBot(secret).expect(200);

      expect(res.body.restaurant).toMatchObject({
        id: seed.restaurantA.id,
        slug: 'tacos-a',
        walletPct: 7.5,
      });
      expect(res.body.branch).toMatchObject({
        id: seed.branchA.id,
        slug: seed.branchA.slug,
        phoneNumberAssistant: ASSISTANT_PHONE,
        phoneNumberReception: RECEPTION_PHONE,
        whatsappPhoneNumberId: '1439262192594415',
        verifyLocation: true,
        dailyCloseTime: '22:15',
        timezone: 'America/Hermosillo',
        commissionPct: 0.5,
        hours: [
          { days: [1, 2, 3, 4, 5, 6], opens: '13:00', closes: '01:00' },
          { days: [0], opens: '13:00', closes: '20:00' },
        ],
      });
      expect(res.body.catalog).toEqual([
        {
          id: seed.menuItem.id,
          name: 'TACO AL PASTOR',
          description: '',
          price: 25,
          category: 'TACOS',
          variantGroup: null,
          isActive: true,
          isRecommended: false,
          imageUrl: null,
        },
      ]);
    });

    it('includes switched-off dishes so the bot can say it has none', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const itemUrl = `/v1/menus/menu/${seed.menu.id}/items/${seed.menuItem.id}`;

      await http()
        .patch(itemUrl)
        .set(auth(owner))
        .send({
          isActive: false,
          shouldRecommend: true,
          variantGroup: 'TACOS',
        })
        .expect(200);

      const res = await asBot(secret).expect(200);
      expect(res.body.catalog[0]).toMatchObject({
        isActive: false,
        isRecommended: true,
        variantGroup: 'TACOS',
      });

      await http()
        .patch(itemUrl)
        .set(auth(owner))
        .send({ isActive: true, shouldRecommend: false, variantGroup: null })
        .expect(200);
    });

    it('includes the logo, the privacy notice and the languages switch', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const admin = await tokenFor(seed.superUser.email);
      const other = await tokenFor(seed.clientB.email);
      const restaurantUrl = `/v1/restaurants/${seed.restaurantA.id}`;
      const configUrl = `/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/bot-config`;
      const png = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
      ]);
      const uploadLogo = (token: string, file: Buffer) =>
        http()
          .patch(`${restaurantUrl}/logo`)
          .set(auth(token))
          .attach('file', file, {
            filename: 'logo.png',
            contentType: 'image/png',
          });

      let res = await asBot(secret).expect(200);
      expect(res.body.restaurant).toMatchObject({
        logoUrl: null,
        privacyUrl: null,
      });
      // Las sucursales que ya existían quedan con la pregunta del idioma.
      expect(res.body.branch.features.languages).toBe(true);

      await http()
        .patch(restaurantUrl)
        .set(auth(owner))
        .send({ privacyUrl: 'http://tacos.test/privacidad' })
        .expect(400);
      await http()
        .patch(restaurantUrl)
        .set(auth(owner))
        .send({ privacyUrl: 'https://tacos.test/privacidad' })
        .expect(200);

      const logo = await uploadLogo(owner, png).expect(200);
      expect(logo.body.restaurant.logoUrl).toBe(
        `https://res.cloudinary.com/e2e/image/upload/restaurants/${seed.restaurantA.id}/logo.png`,
      );
      await uploadLogo(other, png).expect(403);
      await uploadLogo(owner, Buffer.from('no es una imagen')).expect(400);

      // Como las demás funciones contratadas, solo un admin la cambia.
      await http()
        .patch(configUrl)
        .set(auth(owner))
        .send({ features: { languages: false } })
        .expect(403);
      await http()
        .patch(configUrl)
        .set(auth(admin))
        .send({ features: { languages: false } })
        .expect(200);

      res = await asBot(secret).expect(200);
      expect(res.body.restaurant).toMatchObject({
        logoUrl: expect.stringContaining('/logo.png'),
        privacyUrl: 'https://tacos.test/privacidad',
      });
      expect(res.body.branch.features.languages).toBe(false);

      // Queda como estaba para las demás pruebas.
      await http().delete(`${restaurantUrl}/logo`).set(auth(owner)).expect(200);
      await http()
        .patch(restaurantUrl)
        .set(auth(owner))
        .send({ privacyUrl: null })
        .expect(200);
      await http()
        .patch(configUrl)
        .set(auth(admin))
        .send({ features: { languages: true } })
        .expect(200);

      res = await asBot(secret).expect(200);
      expect(res.body.restaurant).toMatchObject({
        logoUrl: null,
        privacyUrl: null,
      });
    });

    it('answers 304 until something changes', async () => {
      const first = await asBot(secret).expect(200);
      const etag = first.headers.etag;
      expect(etag).toBeTruthy();

      await asBot(secret).set('If-None-Match', etag).expect(304);

      const owner = await tokenFor(seed.clientA.email);
      await http()
        .patch(`/v1/menus/menu/${seed.menu.id}/items/${seed.menuItem.id}`)
        .set(auth(owner))
        .send({ price: 30 })
        .expect(200);

      const changed = await asBot(secret)
        .set('If-None-Match', etag)
        .expect(200);
      expect(changed.body.catalog[0].price).toBe(30);
    });

    it('stops working if the branch is deactivated', async () => {
      const branches = dataSource.getRepository(Branch);
      await branches.update({ id: seed.branchA.id }, { isActive: false });

      await asBot(secret).expect(403);

      await branches.update({ id: seed.branchA.id }, { isActive: true });
      await asBot(secret).expect(200);
    });

    it('records when a key was last used', async () => {
      const admin = await tokenFor(seed.superUser.email);
      const list = await http().get(keysUrl()).set(auth(admin)).expect(200);
      expect(list.body.keys[0].lastUsedAt).not.toBeNull();
    });

    it('a revoked key stops working', async () => {
      const admin = await tokenFor(seed.superUser.email);
      await http().delete(`${keysUrl()}/${keyId}`).set(auth(admin)).expect(204);

      await asBot(secret).expect(401);

      await http().delete(`${keysUrl()}/${keyId}`).set(auth(admin)).expect(404);
    });
  });

  describe('API docs', () => {
    const SPEC_URL = '/docs/openapi.json';

    it('require the credentials', async () => {
      await http().get(SPEC_URL).expect(401);
      await http().get(SPEC_URL).auth('docs', 'incorrecta').expect(401);
    });

    it('document only the bot routes', async () => {
      const res = await http()
        .get(SPEC_URL)
        .auth('docs', process.env.DOCS_PASSWORD!)
        .expect(200);

      const { paths } = res.body as { paths: Record<string, unknown> };
      const routes = Object.keys(paths);
      expect(routes).toContain('/v1/bot/branch');
      expect(routes).toContain('/v1/bot/orders');
      expect(routes.every((route) => route.startsWith('/v1/bot/'))).toBe(true);
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

    it('the previous panel routes and the WhatsApp webhook no longer exist', async () => {
      const token = await tokenFor(seed.clientA.email);
      const branchQuery = `branchId=${seed.branchA.id}`;

      await http()
        .get(`/v1/messages/notifications?${branchQuery}`)
        .set(auth(token))
        .expect(404);
      await http()
        .get(`/v1/messages/conversations?${branchQuery}`)
        .set(auth(token))
        .expect(404);
      await http()
        .patch(`/v1/messages/${seed.notification.id}/read`)
        .set(auth(token))
        .expect(404);
      await http().post('/v1/messages/webhook').send({}).expect(404);
    });

    it('the Twilio tables and columns are gone', async () => {
      const tables: { table_name: string }[] = await dataSource.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('conversations', 'conversation_messages', 'processed_messages', 'templates')`,
      );
      expect(tables).toEqual([]);

      const columns: { column: string }[] = await dataSource.query(
        `SELECT table_name || '.' || column_name AS "column"
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND (table_name, column_name) IN (('branches', 'availableMessages'), ('branches', 'qrToken'), ('orders', 'interactions'))`,
      );
      expect(columns).toEqual([]);
    });
  });

  describe('accounts', () => {
    const PHONE = '5216441223454';
    const ordersUrl = '/v1/bot/orders';
    let secret: string;
    let ownerToken: string;
    let otherToken: string;
    let codeCounter = 0;

    const nextCode = () => `CTEST${++codeCounter}`;
    const bot = () => ({ 'X-BotBite-Key': secret });
    const item = (quantity = 2, note?: string) => ({
      menuItemId: seed.menuItem.id,
      quantity,
      ...(note && { note }),
    });
    const openAccount = (code: string, extra: object = {}) =>
      http()
        .post(ordersUrl)
        .set(bot())
        .send({
          code,
          phone: PHONE,
          table: 'A5',
          customerName: 'Sergio',
          items: [item()],
          ...extra,
        });
    const setStatus = (code: string, status: string) =>
      http().patch(`${ordersUrl}/${code}`).set(bot()).send({ status });
    const notificationsOf = (orderId: unknown) =>
      dataSource.getRepository(CashierNotification).find({
        where: { orderId: orderId as string },
        order: { createdAt: 'ASC' },
      });
    const roundIdOf = async (code: string, number: number) => {
      const order = await dataSource.getRepository(Order).findOneOrFail({
        where: { code },
        relations: { rounds: true },
      });
      return order.rounds.find((round) => round.number === number)!.id;
    };
    const activeOrders = async () => {
      const res = await http()
        .get(`/v1/orders/active?branchId=${seed.branchA.id}`)
        .set(auth(ownerToken))
        .expect(200);
      return res.body.orders as {
        id: string;
        code: string;
        status: string;
        total: number;
        rounds: { number: number; status: string }[];
      }[];
    };

    beforeAll(async () => {
      await dataSource
        .getRepository(MenuItem)
        .update({ id: seed.menuItem.id }, { price: 25 });
      // Una prueba anterior deja un dominio inexistente: resolverlo en cada aviso
      // ocupa los hilos de DNS y hace esperar a las conexiones a localhost.
      await dataSource
        .getRepository(Branch)
        .update({ id: seed.branchA.id }, { botBaseUrl: null });
      // Otra prueba deja una lista de mesas: aquí se acepta cualquiera.
      await dataSource
        .getRepository(Branch)
        .update({ id: seed.branchA.id }, { validTables: [] });

      ownerToken = await tokenFor(seed.clientA.email);
      otherToken = await tokenFor(seed.clientB.email);
      const admin = await tokenFor(seed.superUser.email);
      const key = await http()
        .post(`/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/bot-keys`)
        .set(auth(admin))
        .send({ name: 'n8n cuentas' })
        .expect(201);
      secret = key.body.secret;
    });

    it('opens the account with its first round and prices from the menu', async () => {
      const res = await openAccount('CFIRST').expect(201);

      expect(res.body.created).toBe(true);
      expect(res.body.order).toMatchObject({
        code: 'CFIRST',
        source: 'whatsapp',
        status: 'open',
        table: 'A5',
        subtotal: 50,
        total: 50,
      });
      expect(res.body.round).toMatchObject({ number: 1, status: 'new' });
      expect(res.body.round.items[0]).toMatchObject({
        name: 'TACO AL PASTOR',
        category: 'TACOS',
        quantity: 2,
        price: 25,
      });

      const customer = await dataSource
        .getRepository(Customer)
        .findOneByOrFail({ phone: `+${PHONE}` });
      expect(customer.name).toBe('Sergio');

      const [notification] = await notificationsOf(res.body.order.id);
      expect(notification.type).toBe('order');
      expect(notification.message).toContain('Sergio en la mesa A5 ha pedido');
      expect(notification.phoneNumber).toBe(`+${PHONE}`);
      expect(notification.roundId).toBe(res.body.round.id);
    });

    it('warns the cashier when the location was not verified', async () => {
      const unverified = await openAccount(nextCode()).expect(201);
      const verified = await openAccount(nextCode(), {
        locationVerified: true,
      }).expect(201);

      const [first] = await notificationsOf(unverified.body.order.id);
      const [second] = await notificationsOf(verified.body.order.id);
      expect(first.message).toContain('POR CONFIRMAR CON EL MESERO');
      expect(second.message).not.toContain('POR CONFIRMAR');
    });

    it('a retried account creates nothing', async () => {
      const code = nextCode();
      const first = await openAccount(code).expect(201);
      const retry = await openAccount(code).expect(200);

      expect(retry.body.created).toBe(false);
      expect(retry.body.order.id).toBe(first.body.order.id);
      expect(retry.body.round.id).toBe(first.body.round.id);
      expect(await notificationsOf(first.body.order.id)).toHaveLength(1);
    });

    it('adds rounds, updates the total and ignores retries', async () => {
      const code = nextCode();
      const { body } = await openAccount(code).expect(201);
      const send = () =>
        http()
          .post(`${ordersUrl}/${code}/rounds`)
          .set(bot())
          .send({ number: 2, items: [item(1, 'sin cebolla')] });

      const second = await send().expect(201);
      expect(second.body.order.total).toBe(75);
      expect(second.body.round.items[0].note).toBe('sin cebolla');

      const retry = await send().expect(200);
      expect(retry.body.created).toBe(false);
      expect(retry.body.round.id).toBe(second.body.round.id);
      expect(retry.body.order.total).toBe(75);
      expect(await notificationsOf(body.order.id)).toHaveLength(2);
    });

    it('rejects dishes of another branch and prices sent by the bot', async () => {
      const code = nextCode();
      await openAccount(code, {
        items: [{ menuItemId: seed.foreignMenuItem.id, quantity: 1 }],
      }).expect(400);

      const orders = dataSource.getRepository(Order);
      expect(await orders.existsBy({ code })).toBe(false);

      await openAccount(code, {
        items: [{ ...item(), price: 1 }],
      }).expect(400);
    });

    it('validates quantities', async () => {
      await openAccount(nextCode(), { items: [item(0)] }).expect(400);
      await openAccount(nextCode(), { items: [item(51)] }).expect(400);
      await openAccount(nextCode(), { items: [] }).expect(400);
    });

    it('a key cannot touch accounts of another branch', async () => {
      const code = nextCode();
      await openAccount(code).expect(201);

      const admin = await tokenFor(seed.superUser.email);
      const branches = dataSource.getRepository(Branch);
      const other = await branches.save(
        branches.create({
          name: 'Otra',
          slug: 'otra',
          address: 'Calle 9',
          restaurantId: seed.restaurantA.id,
        }),
      );
      const key = await http()
        .post(`/v1/branches/${seed.restaurantA.id}/${other.id}/bot-keys`)
        .set(auth(admin))
        .send({ name: 'otra' })
        .expect(201);
      const otherKey = { 'X-BotBite-Key': key.body.secret as string };

      await http()
        .post(`${ordersUrl}/${code}/rounds`)
        .set(otherKey)
        .send({ number: 2, items: [item()] })
        .expect(404);
      await http()
        .patch(`${ordersUrl}/${code}`)
        .set(otherKey)
        .send({ status: 'bill_requested' })
        .expect(404);
      await http()
        .post(ordersUrl)
        .set(otherKey)
        .send({
          code,
          phone: PHONE,
          table: '1',
          items: [item()],
        })
        .expect(409);
    });

    it('follows the bill flow and tells the cashier', async () => {
      const code = nextCode();
      const { body } = await openAccount(code).expect(201);

      await setStatus(code, 'with_waiter').expect(409);

      const billed = await setStatus(code, 'bill_requested').expect(200);
      expect(billed.body.order.billRequestedAt).not.toBeNull();

      // Repetir el aviso no genera otra notificación.
      await setStatus(code, 'bill_requested').expect(200);

      // Con la cuenta pedida ya no se agrega nada.
      await http()
        .post(`${ordersUrl}/${code}/rounds`)
        .set(bot())
        .send({ number: 2, items: [item()] })
        .expect(409);

      const waiter = await setStatus(code, 'with_waiter').expect(200);
      expect(waiter.body.order.paymentMethod).toBe('waiter');

      const notifications = await notificationsOf(body.order.id);
      expect(notifications.map((n) => n.type)).toEqual([
        'order',
        'bill',
        'pay_with_waiter',
      ]);
    });

    it('the bot cannot set statuses reserved to payments or the cashier', async () => {
      const code = nextCode();
      await openAccount(code).expect(201);

      for (const status of ['paid', 'settled', 'open']) {
        await setStatus(code, status).expect(400);
      }
      // `cancelled` es solo para pedidos sin pagar; una cuenta de mesa la cancela caja.
      await setStatus(code, 'cancelled').expect(409);
    });

    it('the panel sees active accounts and moves the rounds', async () => {
      const code = nextCode();
      await openAccount(code).expect(201);
      const roundId = await roundIdOf(code, 1);
      const roundUrl = `/v1/orders/rounds/${roundId}`;

      const account = (await activeOrders()).find((o) => o.code === code);
      expect(account?.rounds[0]).toMatchObject({ number: 1, status: 'new' });

      await http()
        .patch(roundUrl)
        .set(auth(otherToken))
        .send({ status: 'preparing' })
        .expect(403);

      const preparing = await http()
        .patch(roundUrl)
        .set(auth(ownerToken))
        .send({ status: 'preparing' })
        .expect(200);
      expect(preparing.body.round.acknowledgedAt).not.toBeNull();

      await http()
        .patch(roundUrl)
        .set(auth(ownerToken))
        .send({ status: 'new' })
        .expect(400);

      const delivered = await http()
        .patch(roundUrl)
        .set(auth(ownerToken))
        .send({ status: 'delivered' })
        .expect(200);
      expect(delivered.body.round.deliveredAt).not.toBeNull();

      await http()
        .patch(roundUrl)
        .set(auth(ownerToken))
        .send({ status: 'cancelled' })
        .expect(409);
    });

    it('cancelling a round takes it out of the total', async () => {
      const code = nextCode();
      await openAccount(code).expect(201);
      await http()
        .post(`${ordersUrl}/${code}/rounds`)
        .set(bot())
        .send({ number: 2, items: [item(1)] })
        .expect(201);

      await http()
        .patch(`/v1/orders/rounds/${await roundIdOf(code, 1)}`)
        .set(auth(ownerToken))
        .send({ status: 'cancelled' })
        .expect(200);

      const account = (await activeOrders()).find((o) => o.code === code);
      expect(account?.total).toBe(25);
    });

    it('the cashier settles an account and it leaves the active list', async () => {
      const code = nextCode();
      const { body } = await openAccount(code).expect(201);
      const url = `/v1/orders/${body.order.id}/settle`;

      await http().post(url).set(auth(otherToken)).expect(403);

      const settled = await http().post(url).set(auth(ownerToken)).expect(200);
      expect(settled.body.order).toMatchObject({
        status: 'settled',
        paymentMethod: 'waiter',
      });
      expect(settled.body.order.closedAt).not.toBeNull();

      expect((await activeOrders()).some((o) => o.code === code)).toBe(false);

      await http().post(url).set(auth(ownerToken)).expect(409);
      await http()
        .post(`${ordersUrl}/${code}/rounds`)
        .set(bot())
        .send({ number: 2, items: [item()] })
        .expect(409);
    });

    it('staff open their own accounts, without a customer', async () => {
      const res = await http()
        .post('/v1/orders/tabs')
        .set(auth(ownerToken))
        .send({
          branchId: seed.branchA.id,
          table: 'BARRA',
          customerName: 'Don Pepe',
          items: [item(1)],
        })
        .expect(201);

      expect(res.body.order).toMatchObject({
        source: 'staff',
        status: 'open',
        table: 'BARRA',
        total: 25,
      });
      expect(res.body.order.code).toMatch(/^S[A-F0-9]{10}$/);

      const round = await http()
        .post(`/v1/orders/${res.body.order.id}/rounds`)
        .set(auth(ownerToken))
        .send({ items: [item(2)] })
        .expect(201);
      expect(round.body.round.number).toBe(2);
      expect(round.body.order.total).toBe(75);

      await http()
        .post('/v1/orders/tabs')
        .set(auth(otherToken))
        .send({ branchId: seed.branchA.id, table: '1', items: [item()] })
        .expect(403);
    });

    it('rounds of a WhatsApp account only come from the bot', async () => {
      const { body } = await openAccount(nextCode()).expect(201);

      await http()
        .post(`/v1/orders/${body.order.id}/rounds`)
        .set(auth(ownerToken))
        .send({ items: [item()] })
        .expect(409);
    });

    it('the old write routes no longer exist', async () => {
      await http()
        .post('/v1/orders')
        .set(auth(ownerToken))
        .send({})
        .expect(404);
    });

    it('staff read the catalog of their branch to open accounts', async () => {
      const url = `/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/catalog`;
      const res = await http().get(url).set(auth(ownerToken)).expect(200);

      expect(res.body.catalog[0].id).toBe(seed.menuItem.id);
      await http().get(url).set(auth(otherToken)).expect(403);
    });

    it('shows the indicators of the day', async () => {
      const res = await http()
        .get(`/v1/orders/summary?branchId=${seed.branchA.id}`)
        .set(auth(ownerToken))
        .expect(200);

      expect(res.body.accounts).toBeGreaterThan(0);
      expect(res.body.openAccounts).toBeGreaterThan(0);
      expect(res.body.paidWithWaiter).toBeGreaterThan(0);
      expect(res.body.sales).toBeGreaterThan(0);
      expect(res.body.averageTicket).toBeGreaterThan(0);
    });

    it('only takes tables the branch accepts', async () => {
      const branches = dataSource.getRepository(Branch);
      const retried = nextCode();
      await openAccount(retried, { table: '40' }).expect(201);
      await branches.update(
        { id: seed.branchA.id },
        { validTables: ['A5', 'TERRAZA 2'] },
      );

      try {
        const bot = await openAccount(nextCode(), { table: 'a5' }).expect(201);
        expect(bot.body.order.table).toBe('A5');
        await openAccount(nextCode(), { table: '99' }).expect(400);

        const tabs = (table: string) =>
          http()
            .post('/v1/orders/tabs')
            .set(auth(ownerToken))
            .send({ branchId: seed.branchA.id, table, items: [item()] });
        const tab = await tabs('terraza  2').expect(201);
        expect(tab.body.order.table).toBe('TERRAZA 2');
        await tabs('7').expect(400);

        // Un reintento de una cuenta ya abierta no se vuelve a validar.
        await openAccount(retried, { table: '40' }).expect(200);

        const catalog = await http()
          .get(`/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/catalog`)
          .set(auth(ownerToken))
          .expect(200);
        expect(catalog.body.validTables).toEqual(['A5', 'TERRAZA 2']);
      } finally {
        await branches.update({ id: seed.branchA.id }, { validTables: [] });
      }
    });

    it('accepts free alerts for the cashier', async () => {
      const url = '/v1/bot/notifications';

      const created = await http()
        .post(url)
        .set(bot())
        .send({ type: 'alert', message: 'Pago sin cuenta asociada' })
        .expect(201);
      const notification = await dataSource
        .getRepository(CashierNotification)
        .findOneByOrFail({ id: created.body.id });
      expect(notification.type).toBe('alert');

      await http()
        .post(url)
        .set(bot())
        .send({ type: 'alert', message: 'x', orderCode: 'NOEXISTE' })
        .expect(404);
      await http()
        .post(url)
        .set(bot())
        .send({ type: 'order', message: 'x' })
        .expect(400);
    });

    it('does not repeat an alert sent again with the same eventId', async () => {
      const url = '/v1/bot/notifications';
      const notifications = dataSource.getRepository(CashierNotification);
      const body = {
        type: 'alert',
        message: 'La factura no se pudo timbrar',
        eventId: randomUUID(),
      };

      const first = await http().post(url).set(bot()).send(body).expect(201);
      expect(first.body).toEqual({ id: expect.any(String), created: true });

      const again = await http().post(url).set(bot()).send(body).expect(200);
      expect(again.body).toEqual({ id: first.body.id, created: false });

      // Reintentos a la vez de un aviso nuevo: solo uno se guarda.
      const concurrent = { ...body, eventId: randomUUID() };
      const responses = await Promise.all(
        [1, 2, 3].map(() => http().post(url).set(bot()).send(concurrent)),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 201]);
      expect(
        new Set(responses.map((r) => (r.body as { id: string }).id)).size,
      ).toBe(1);

      expect(await notifications.countBy({ eventId: body.eventId })).toBe(1);
      expect(await notifications.countBy({ eventId: concurrent.eventId })).toBe(
        1,
      );

      await http()
        .post(url)
        .set(bot())
        .send({ ...body, eventId: 'no-es-un-uuid' })
        .expect(400);
    });

    describe('under load', () => {
      it('opens many accounts at once, each with its retries', async () => {
        const codes = Array.from({ length: 15 }, () => nextCode());

        const responses = await Promise.all(
          codes.flatMap((code) => [
            openAccount(code),
            openAccount(code),
            openAccount(code),
          ]),
        );

        expect(responses.filter((r) => r.status === 201)).toHaveLength(15);
        expect(responses.every((r) => [200, 201].includes(r.status))).toBe(
          true,
        );

        for (const code of codes) {
          const order = await dataSource
            .getRepository(Order)
            .findOneOrFail({ where: { code }, relations: { rounds: true } });
          expect(order.rounds).toHaveLength(1);
          expect(Number(order.total)).toBe(50);
          expect(await notificationsOf(order.id)).toHaveLength(1);
        }
      });

      it('keeps the total right with rounds at the same time', async () => {
        const code = nextCode();
        await openAccount(code, { items: [item(1)] }).expect(201);

        const rounds = Array.from({ length: 8 }, (_, index) => index + 2);
        const responses = await Promise.all(
          rounds.map((number) =>
            http()
              .post(`${ordersUrl}/${code}/rounds`)
              .set(bot())
              .send({ number, items: [item(1)] }),
          ),
        );

        expect(responses.every((r) => r.status === 201)).toBe(true);

        const account = (await activeOrders()).find((o) => o.code === code);
        expect(account?.rounds).toHaveLength(9);
        expect(account?.total).toBe(225);
      });
    });

    describe('customers, wallet and payments', () => {
      let otherSecret: string;
      let phoneCounter = 0;

      const nextPhone = () =>
        `52164400${String(++phoneCounter).padStart(5, '0')}`;
      const openFor = (phone: string, extra: object = {}) => {
        const code = nextCode();
        return openAccount(code, { phone, ...extra })
          .expect(201)
          .then(() => code);
      };
      const lookup = async (phone: string, key = secret) => {
        const res = await http()
          .post('/v1/bot/customers/lookup')
          .set({ 'X-BotBite-Key': key })
          .send({ phone })
          .expect(200);
        return res.body as {
          known: boolean;
          name: string;
          visits: number;
          promos: string;
          unsubscribedAt: string | null;
          walletBalance: number;
        };
      };
      const giveWallet = async (phone: string, walletBalance: number) => {
        const customer = await dataSource
          .getRepository(Customer)
          .findOneByOrFail({ phone: `+${phone}` });
        await dataSource
          .getRepository(RestaurantCustomer)
          .update({ customerId: customer.id }, { walletBalance });
      };
      const askBill = (code: string, extra: object = {}) =>
        http()
          .patch(`${ordersUrl}/${code}`)
          .set(bot())
          .send({ status: 'bill_requested', ...extra });
      const sendLink = (code: string, tip = 0) =>
        http()
          .patch(`${ordersUrl}/${code}`)
          .set(bot())
          .send({ status: 'payment_link', tip })
          .expect(200);
      const pay = (
        providerPaymentId: string,
        amount: number,
        orderCode?: string,
        key = secret,
      ) =>
        http().post('/v1/bot/payments').set({ 'X-BotBite-Key': key }).send({
          orderCode,
          providerPaymentId,
          amount,
          paymentType: 'credit_card',
        });
      const orderOf = (code: string) =>
        dataSource.getRepository(Order).findOneByOrFail({ code });
      const movementsOf = (orderId: string) =>
        dataSource.getRepository(WalletMovement).find({
          where: { orderId },
          order: { createdAt: 'ASC' },
        });
      const paymentId = () => `MP${nextCode()}`;

      beforeAll(async () => {
        await dataSource
          .getRepository(Restaurant)
          .update({ id: seed.restaurantA.id }, { walletPct: 5 });

        // Una prueba anterior desactiva la sucursal B.
        const branches = dataSource.getRepository(Branch);
        const otherBranch = await branches.save(
          branches.create({
            name: 'Sur',
            slug: 'sur',
            address: 'Calle 3',
            restaurantId: seed.restaurantB.id,
          }),
        );
        const admin = await tokenFor(seed.superUser.email);
        const key = await http()
          .post(
            `/v1/branches/${seed.restaurantB.id}/${otherBranch.id}/bot-keys`,
          )
          .set(auth(admin))
          .send({ name: 'n8n otro restaurante' })
          .expect(201);
        otherSecret = key.body.secret;
      });

      describe('customers', () => {
        it('counts one visit per account, not per retry', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await openAccount(code, { phone }).expect(200);
          await openFor(phone, { afterPreviousBill: true });
          await openFor(phone);

          const customer = await lookup(phone);
          expect(customer).toMatchObject({
            known: true,
            name: 'Sergio',
            visits: 2,
            promos: 'pending',
            walletBalance: 0,
          });
        });

        it('answers without error for someone who never came', async () => {
          await expect(lookup(nextPhone())).resolves.toMatchObject({
            known: false,
            visits: 0,
            walletBalance: 0,
          });
        });

        it('keeps customers apart between restaurants', async () => {
          const phone = nextPhone();
          await openFor(phone);
          await giveWallet(phone, 80);

          await expect(lookup(phone, otherSecret)).resolves.toMatchObject({
            known: false,
            name: '',
            walletBalance: 0,
          });
        });

        it('saves the answer to promotions and the unsubscribe', async () => {
          const phone = nextPhone();
          const url = '/v1/bot/customers';

          const accepted = await http()
            .patch(url)
            .set(bot())
            .send({ phone, name: 'Ana', promos: 'accepted' })
            .expect(200);
          expect(accepted.body).toMatchObject({
            known: true,
            name: 'Ana',
            promos: 'accepted',
          });

          const left = await http()
            .patch(url)
            .set(bot())
            .send({ phone, unsubscribed: true })
            .expect(200);
          expect(left.body.promos).toBe('declined');
          expect(left.body.unsubscribedAt).not.toBeNull();

          const back = await http()
            .patch(url)
            .set(bot())
            .send({ phone, promos: 'accepted' })
            .expect(200);
          expect(back.body.unsubscribedAt).toBeNull();

          await http()
            .patch(url)
            .set(bot())
            .send({ phone, promos: 'pending' })
            .expect(400);
        });
      });

      describe('wallet', () => {
        it('discounts what the customer chose and leaves a record', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await giveWallet(phone, 80);

          const res = await askBill(code, {
            walletUse: 'amount',
            walletAmount: 30,
          }).expect(200);

          expect(res.body.order).toMatchObject({
            subtotal: 50,
            walletDiscount: 30,
            total: 20,
            amountDue: 20,
          });
          expect(res.body.walletBalance).toBe(50);
          expect(res.body.walletCapped).toBe(false);

          const [movement] = await movementsOf(res.body.order.id);
          expect(movement.type).toBe('use');
          expect(Number(movement.amount)).toBe(-30);
          expect(Number(movement.balanceAfter)).toBe(50);

          const notices = await notificationsOf(res.body.order.id);
          expect(notices[notices.length - 1].message).toContain(
            'monedero: -$30.00',
          );
        });

        it('caps the discount to the balance and to the subtotal', async () => {
          const poor = nextPhone();
          const poorCode = await openFor(poor);
          await giveWallet(poor, 12.5);

          const capped = await askBill(poorCode, {
            walletUse: 'amount',
            walletAmount: 40,
          }).expect(200);
          expect(capped.body.order.walletDiscount).toBe(12.5);
          expect(capped.body.walletBalance).toBe(0);
          expect(capped.body.walletCapped).toBe(true);

          const rich = nextPhone();
          const richCode = await openFor(rich);
          await giveWallet(rich, 500);

          const whole = await askBill(richCode, { walletUse: 'all' }).expect(
            200,
          );
          expect(whole.body.order.total).toBe(0);
          expect(whole.body.order.walletDiscount).toBe(50);
          expect(whole.body.walletBalance).toBe(450);
          expect(whole.body.walletCapped).toBe(false);
        });

        it('does not discount twice when the bot retries', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await giveWallet(phone, 80);

          await askBill(code, { walletUse: 'all' }).expect(200);
          const retry = await askBill(code, { walletUse: 'all' }).expect(200);

          expect(retry.body.order.walletDiscount).toBe(50);
          expect(retry.body.walletBalance).toBe(30);
          expect(await movementsOf(retry.body.order.id)).toHaveLength(1);
        });

        it('does nothing when the customer declines', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await giveWallet(phone, 80);

          const res = await askBill(code, { walletUse: 'none' }).expect(200);
          expect(res.body.order.walletDiscount).toBe(0);
          expect(res.body.walletBalance).toBe(80);
        });

        it('requires an amount with walletUse amount', async () => {
          const code = await openFor(nextPhone());

          await askBill(code, { walletUse: 'amount' }).expect(400);
          await askBill(code, {
            walletUse: 'amount',
            walletAmount: -5,
          }).expect(400);
        });

        it('never spends the same balance twice at the same time', async () => {
          const phone = nextPhone();
          const codes = [
            await openFor(phone),
            await openFor(phone),
            await openFor(phone),
          ];
          await giveWallet(phone, 70);

          const responses = await Promise.all(
            codes.map((code) => askBill(code, { walletUse: 'all' })),
          );

          expect(responses.every((r) => r.status === 200)).toBe(true);
          const used = responses.reduce(
            (sum, r) => sum + Number(r.body.order.walletDiscount),
            0,
          );
          expect(used).toBe(70);
          expect((await lookup(phone)).walletBalance).toBe(0);
        });

        it('returns the balance when the account is cancelled', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await giveWallet(phone, 80);
          const { body } = await askBill(code, { walletUse: 'all' }).expect(
            200,
          );

          await http()
            .post(`/v1/orders/${body.order.id}/cancel`)
            .set(auth(ownerToken))
            .expect(200);

          expect((await lookup(phone)).walletBalance).toBe(80);
          const movements = await movementsOf(body.order.id);
          expect(movements.map((m) => m.type)).toEqual(['use', 'adjustment']);
          expect(movements[1].note).toBe('Cuenta cancelada');
          expect(Number((await orderOf(code)).walletDiscount)).toBe(0);
        });

        it('returns the excess when a cancelled round lowers the bill', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await http()
            .post(`${ordersUrl}/${code}/rounds`)
            .set(bot())
            .send({ number: 2, items: [item(2)] })
            .expect(201);
          await giveWallet(phone, 80);
          await askBill(code, { walletUse: 'all' }).expect(200);

          await http()
            .patch(`/v1/orders/rounds/${await roundIdOf(code, 2)}`)
            .set(auth(ownerToken))
            .send({ status: 'cancelled' })
            .expect(200);

          const order = await orderOf(code);
          expect(Number(order.subtotal)).toBe(50);
          expect(Number(order.walletDiscount)).toBe(50);
          expect(Number(order.total)).toBe(0);
          expect((await lookup(phone)).walletBalance).toBe(30);
        });

        it('keeps the discount when the bill stays above it', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await http()
            .post(`${ordersUrl}/${code}/rounds`)
            .set(bot())
            .send({ number: 2, items: [item(2)] })
            .expect(201);
          await giveWallet(phone, 20);
          await askBill(code, { walletUse: 'all' }).expect(200);

          await http()
            .patch(`/v1/orders/rounds/${await roundIdOf(code, 2)}`)
            .set(auth(ownerToken))
            .send({ status: 'cancelled' })
            .expect(200);

          const order = await orderOf(code);
          expect(Number(order.walletDiscount)).toBe(20);
          expect(Number(order.total)).toBe(30);
          expect((await lookup(phone)).walletBalance).toBe(0);
        });

        it('ignores the wallet when the branch has it off', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await giveWallet(phone, 80);
          const branches = dataSource.getRepository(Branch);
          const { features } = await branches.findOneByOrFail({
            id: seed.branchA.id,
          });
          await branches.update(
            { id: seed.branchA.id },
            { features: { ...features, wallet: false } },
          );

          try {
            const res = await askBill(code, { walletUse: 'all' }).expect(200);
            expect(res.body.order.walletDiscount).toBe(0);

            await sendLink(code);
            const paid = await pay(paymentId(), 50, code).expect(201);
            expect(paid.body.status).toBe('approved');
            expect(paid.body.cashback).toBe(0);
            expect(paid.body.walletBalance).toBe(80);
          } finally {
            await branches.update({ id: seed.branchA.id }, { features });
          }
        });
      });

      describe('payments', () => {
        it('closes the account and earns cashback without the tip', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await askBill(code).expect(200);

          const link = await sendLink(code, 10);
          expect(link.body.order).toMatchObject({
            status: 'payment_link',
            total: 50,
            tip: 10,
            amountDue: 60,
          });

          const id = paymentId();
          const res = await pay(id, 60, code).expect(201);

          expect(res.body).toMatchObject({
            created: true,
            status: 'approved',
            cashback: 2.5,
            walletBalance: 2.5,
          });
          expect(res.body.order.status).toBe('paid');
          expect(res.body.order.paymentMethod).toBe('mercado_pago');
          expect(res.body.order.closedAt).not.toBeNull();

          const payment = await dataSource
            .getRepository(Payment)
            .findOneByOrFail({ providerPaymentId: id });
          expect(Number(payment.consumption)).toBe(50);
          expect(Number(payment.tip)).toBe(10);
          expect(Number(payment.amount)).toBe(60);
          expect(Number(payment.paidAmount)).toBe(60);
          expect(payment.paymentType).toBe('credit_card');

          const [movement] = await movementsOf(res.body.order.id);
          expect(movement.type).toBe('cashback');
          expect(Number(movement.amount)).toBe(2.5);

          const notices = await notificationsOf(res.body.order.id);
          const notice = notices[notices.length - 1];
          expect(notice.type).toBe('payment');
          expect(notice.message).toContain('consumo $50.00 + propina $10.00');
        });

        it('keeps the commission the bot used for the table link', async () => {
          const code = await openFor(nextPhone());
          await askBill(code).expect(200);

          // Solo con payment_link.
          await askBill(code, { commissionPct: 0.5 }).expect(400);

          await http()
            .patch(`${ordersUrl}/${code}`)
            .set(bot())
            .send({ status: 'payment_link', tip: 0, commissionPct: 0.5 })
            .expect(200);
          expect(Number((await orderOf(code)).commissionPct)).toBe(0.5);

          // Un link nuevo con otra comisión la actualiza.
          const relink = await http()
            .patch(`${ordersUrl}/${code}`)
            .set(bot())
            .send({ status: 'payment_link', commissionPct: 1 })
            .expect(200);
          expect(relink.body.order.commissionPct).toBe(1);
        });

        it('earns cashback on what was paid, after the discount', async () => {
          const phone = nextPhone();
          const code = await openFor(phone, { items: [item(1)] });
          await giveWallet(phone, 14.9);
          await askBill(code, { walletUse: 'all' }).expect(200);
          await sendLink(code);

          const res = await pay(paymentId(), 10.1, code).expect(201);

          // 5 % de 10.10 son 0.505: redondea como el bot.
          expect(res.body.cashback).toBe(0.51);
          expect(res.body.walletBalance).toBe(0.51);
        });

        it('does not process the same notice twice', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await askBill(code).expect(200);
          await sendLink(code);
          const id = paymentId();

          const first = await pay(id, 50, code).expect(201);
          const retry = await pay(id, 50, code).expect(200);

          expect(retry.body).toMatchObject({
            created: false,
            status: 'approved',
            cashback: 2.5,
            walletBalance: 2.5,
          });

          const payments = await notificationsOf(first.body.order.id);
          expect(
            payments.filter((n) => n.type === NotificationType.PAYMENT),
          ).toHaveLength(1);
          expect(await movementsOf(first.body.order.id)).toHaveLength(1);
        });

        it('survives the same notice arriving at the same time', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await askBill(code).expect(200);
          await sendLink(code);
          const id = paymentId();

          const responses = await Promise.all(
            Array.from({ length: 6 }, () => pay(id, 50, code)),
          );

          expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
          expect(responses.filter((r) => r.status === 200)).toHaveLength(5);
          expect((await lookup(phone)).walletBalance).toBe(2.5);
        });

        it('leaves the account open when less money arrives', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await askBill(code).expect(200);
          await sendLink(code, 10);

          const res = await pay(paymentId(), 40, code).expect(201);

          expect(res.body).toMatchObject({
            status: 'incomplete',
            cashback: 0,
            walletBalance: 0,
          });
          expect((await orderOf(code)).status).toBe('payment_link');

          const notices = await notificationsOf(res.body.order.id);
          const notice = notices[notices.length - 1];
          expect(notice.type).toBe('alert');
          expect(notice.message).toContain('la cuenta era de $60.00');
        });

        it('forgives the rounding of the provider', async () => {
          const code = await openFor(nextPhone());
          await askBill(code).expect(200);
          await sendLink(code);

          const res = await pay(paymentId(), 49.5, code).expect(201);

          expect(res.body.status).toBe('approved');
        });

        it('keeps a payment without an account and warns the cashier', async () => {
          const id = paymentId();

          const res = await pay(id, 123.45, 'NOEXISTE').expect(201);
          expect(res.body).toMatchObject({
            status: 'unmatched',
            cashback: 0,
            walletBalance: null,
            order: null,
          });

          await pay(id, 123.45, 'NOEXISTE').expect(200);

          const payment = await dataSource
            .getRepository(Payment)
            .findOneByOrFail({ providerPaymentId: id });
          expect(payment.orderId).toBeNull();
          expect(payment.branchId).toBe(seed.branchA.id);

          const notices = await dataSource
            .getRepository(CashierNotification)
            .findBy({ message: Like(`%operación ${id}%`) });
          expect(notices).toHaveLength(1);
          expect(notices[0].message).toContain('sin cuenta asociada');
        });

        it('warns once when an orphan payment arrives repeated', async () => {
          const id = paymentId();

          const responses = await Promise.all(
            Array.from({ length: 5 }, () => pay(id, 80, 'NOEXISTE')),
          );

          expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
          expect(responses.filter((r) => r.status === 200)).toHaveLength(4);

          const notices = await dataSource
            .getRepository(CashierNotification)
            .findBy({ message: Like(`%operación ${id}%`) });
          expect(notices).toHaveLength(1);
        });

        it('does not touch an account of another branch', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await askBill(code).expect(200);

          const res = await pay(paymentId(), 50, code, otherSecret).expect(201);

          expect(res.body.status).toBe('unmatched');
          expect(res.body.order).toBeNull();
          expect((await orderOf(code)).status).toBe('bill_requested');
          expect((await lookup(phone)).walletBalance).toBe(0);
        });

        it('rejects a payment id already used by another branch', async () => {
          const id = paymentId();

          await pay(id, 10).expect(201);
          await pay(id, 10, undefined, otherSecret).expect(409);
        });

        it('warns when the account was already closed', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await askBill(code).expect(200);
          await sendLink(code);
          const { id } = await orderOf(code);

          await http()
            .post(`/v1/orders/${id}/settle`)
            .set(auth(ownerToken))
            .expect(200);

          const res = await pay(paymentId(), 50, code).expect(201);

          expect(res.body.status).toBe('unmatched');
          expect(res.body.cashback).toBe(0);
          expect((await orderOf(code)).status).toBe('settled');

          const notices = await notificationsOf(id);
          expect(notices[notices.length - 1].message).toContain(
            'ya estaba cerrada',
          );
        });

        it('gives no cashback when the waiter charges', async () => {
          const phone = nextPhone();
          const code = await openFor(phone);
          await askBill(code).expect(200);
          await setStatus(code, 'with_waiter').expect(200);
          const { id } = await orderOf(code);

          await http()
            .post(`/v1/orders/${id}/settle`)
            .set(auth(ownerToken))
            .expect(200);

          expect((await lookup(phone)).walletBalance).toBe(0);
        });

        it('lets the tip change until the link goes out', async () => {
          const code = await openFor(nextPhone());
          await askBill(code).expect(200);

          await sendLink(code, 10);
          const changed = await sendLink(code, 15);
          expect(changed.body.order.tip).toBe(15);

          const waiter = await setStatus(code, 'with_waiter').expect(200);
          expect(waiter.body.order.tip).toBe(0);
          expect(waiter.body.order.amountDue).toBe(50);
        });

        it('keeps a paid account visible while the kitchen works', async () => {
          const code = await openFor(nextPhone());
          await askBill(code).expect(200);
          await sendLink(code);
          await pay(paymentId(), 50, code).expect(201);

          const account = (await activeOrders()).find((o) => o.code === code);
          expect(account?.status).toBe('paid');

          const roundUrl = `/v1/orders/rounds/${await roundIdOf(code, 1)}`;
          await http()
            .patch(roundUrl)
            .set(auth(ownerToken))
            .send({ status: 'cancelled' })
            .expect(409);
          await http()
            .patch(roundUrl)
            .set(auth(ownerToken))
            .send({ status: 'delivered' })
            .expect(200);

          expect((await activeOrders()).some((o) => o.code === code)).toBe(
            false,
          );
        });
      });

      describe('invoices', () => {
        let invoiceCounter = 0;

        const CUSTOMER = {
          rfc: 'XAXX010101000',
          legalName: 'JUAN PEREZ LOPEZ',
          zip: '83000',
          taxRegime: '612',
        };
        const invoiceBody = (orderCode: string, extra: object = {}) => {
          const n = ++invoiceCounter;
          return {
            orderCode,
            providerInvoiceId: `FAPI${String(n).padStart(8, '0')}`,
            uuid: randomUUID().toUpperCase(),
            folio: String(100 + n),
            total: 50,
            paymentForm: '04',
            cfdiUse: 'G03',
            emailSent: true,
            customer: CUSTOMER,
            ...extra,
          };
        };
        const invoice = (body: object, key = secret) =>
          http()
            .post('/v1/bot/invoices')
            .set({ 'X-BotBite-Key': key })
            .send(body);
        const lookupTax = async (phone: string, key = secret) => {
          const res = await http()
            .post('/v1/bot/customers/lookup')
            .set({ 'X-BotBite-Key': key })
            .send({ phone, includeTaxProfile: true })
            .expect(200);
          return res.body as {
            known: boolean;
            hasTaxProfile: boolean;
            taxProfile: Record<string, unknown> | null;
          };
        };
        const servedAccount = async (phone: string) => {
          const code = await openFor(phone);
          await askBill(code).expect(200);
          await setStatus(code, 'with_waiter').expect(200);
          return code;
        };
        const invoicesOf = async (code: string) =>
          dataSource
            .getRepository(Invoice)
            .findBy({ orderId: (await orderOf(code)).id });

        it('records the invoice, tells the cashier and ignores retries', async () => {
          const code = await servedAccount(nextPhone());
          const uuid = randomUUID();
          const body = invoiceBody(code, {
            uuid,
            customer: { ...CUSTOMER, rfc: ' xaxx-010101000 ' },
          });

          const first = await invoice(body).expect(201);
          expect(first.body).toMatchObject({
            created: true,
            repeated: false,
            hasTaxProfile: false,
            invoice: {
              folio: body.folio,
              total: 50,
              orderCode: code,
              uuid: uuid.toUpperCase(),
            },
          });

          const retry = await invoice(body).expect(200);
          expect(retry.body.created).toBe(false);
          expect(retry.body.invoice.id).toBe(first.body.invoice.id);

          const saved = await invoicesOf(code);
          expect(saved).toHaveLength(1);
          expect(saved[0]).toMatchObject({
            rfc: 'XAXX010101000',
            legalName: 'JUAN PEREZ LOPEZ',
            paymentForm: '04',
            cfdiUse: 'G03',
            emailSent: true,
          });

          const notices = (await notificationsOf(saved[0].orderId)).filter(
            (n) => n.type === NotificationType.INVOICE,
          );
          expect(notices).toHaveLength(1);
          expect(notices[0].message).toContain(`factura ${body.folio}`);
          expect(notices[0].message).not.toContain('XAXX');
        });

        it('survives the same invoice arriving at the same time', async () => {
          const code = await servedAccount(nextPhone());
          const body = invoiceBody(code);

          const responses = await Promise.all(
            Array.from({ length: 5 }, () => invoice(body)),
          );

          expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
          expect(responses.filter((r) => r.status === 200)).toHaveLength(4);
          expect(await invoicesOf(code)).toHaveLength(1);
        });

        it('saves the tax data only when the customer accepts', async () => {
          const phone = nextPhone();

          const without = await invoice(
            invoiceBody(await servedAccount(phone)),
          ).expect(201);
          expect(without.body.hasTaxProfile).toBe(false);
          expect(await lookupTax(phone)).toMatchObject({
            known: true,
            hasTaxProfile: false,
            taxProfile: null,
          });

          const saved = await invoice(
            invoiceBody(await servedAccount(phone), {
              saveTaxProfile: {
                email: 'juan@example.com',
                taxRegimes: ['626'],
              },
            }),
          ).expect(201);
          expect(saved.body.hasTaxProfile).toBe(true);

          expect((await lookupTax(phone)).taxProfile).toMatchObject({
            ...CUSTOMER,
            taxRegimes: ['626', '612'],
            cfdiUse: 'G03',
            email: 'juan@example.com',
          });

          const plain = await http()
            .post('/v1/bot/customers/lookup')
            .set(bot())
            .send({ phone })
            .expect(200);
          expect(plain.body.hasTaxProfile).toBe(true);
          expect(plain.body).not.toHaveProperty('taxProfile');
        });

        it('replaces the saved tax data with the newest', async () => {
          const phone = nextPhone();
          const consent = { saveTaxProfile: { email: 'ana@example.com' } };

          await invoice(
            invoiceBody(await servedAccount(phone), consent),
          ).expect(201);
          await invoice(
            invoiceBody(await servedAccount(phone), {
              ...consent,
              cfdiUse: 'S01',
              customer: { ...CUSTOMER, taxRegime: '626' },
            }),
          ).expect(201);

          expect((await lookupTax(phone)).taxProfile).toMatchObject({
            taxRegime: '626',
            taxRegimes: ['626'],
            cfdiUse: 'S01',
          });
        });

        it('keeps the tax data apart between restaurants', async () => {
          const phone = nextPhone();
          await invoice(
            invoiceBody(await servedAccount(phone), {
              saveTaxProfile: { email: 'ana@example.com' },
            }),
          ).expect(201);

          await expect(lookupTax(phone, otherSecret)).resolves.toMatchObject({
            known: false,
            hasTaxProfile: false,
            taxProfile: null,
          });
        });

        it('deletes the tax data for real when asked', async () => {
          const phone = nextPhone();
          await invoice(
            invoiceBody(await servedAccount(phone), {
              saveTaxProfile: { email: 'ana@example.com' },
            }),
          ).expect(201);

          const res = await http()
            .patch('/v1/bot/customers')
            .set(bot())
            .send({ phone, deleteTaxProfile: true })
            .expect(200);
          expect(res.body.hasTaxProfile).toBe(false);
          expect((await lookupTax(phone)).taxProfile).toBeNull();

          const customer = await dataSource
            .getRepository(Customer)
            .findOneByOrFail({ phone: `+${phone}` });
          const membership = await dataSource
            .getRepository(RestaurantCustomer)
            .findOneByOrFail({
              customerId: customer.id,
              restaurantId: seed.restaurantA.id,
            });
          await expect(
            dataSource.getRepository(CustomerTaxProfile).count({
              where: { restaurantCustomerId: membership.id },
              withDeleted: true,
            }),
          ).resolves.toBe(0);
        });

        it('warns when an account gets a second invoice', async () => {
          const code = await servedAccount(nextPhone());
          const first = invoiceBody(code);
          await invoice(first).expect(201);

          const second = await invoice(invoiceBody(code)).expect(201);
          expect(second.body.repeated).toBe(true);

          const saved = await invoicesOf(code);
          expect(saved).toHaveLength(2);
          const alerts = (await notificationsOf(saved[0].orderId)).filter(
            (n) => n.type === NotificationType.ALERT,
          );
          expect(alerts[alerts.length - 1].message).toContain(
            `ya tenía la factura ${first.folio}`,
          );
        });

        it('rejects the same invoice for another account', async () => {
          const body = invoiceBody(await servedAccount(nextPhone()));
          await invoice(body).expect(201);

          await invoice({
            ...body,
            orderCode: await servedAccount(nextPhone()),
          }).expect(409);
        });

        it('does not touch an account of another branch', async () => {
          const code = await servedAccount(nextPhone());

          await invoice(invoiceBody(code), otherSecret).expect(404);
          await invoice(invoiceBody('CNOEXISTE')).expect(404);
          expect(await invoicesOf(code)).toHaveLength(0);
        });

        it('validates the fiscal data', async () => {
          const code = await servedAccount(nextPhone());
          const wrong = [
            { customer: { ...CUSTOMER, rfc: 'XAXX0101' } },
            { customer: { ...CUSTOMER, zip: '8300' } },
            { customer: { ...CUSTOMER, email: 'juan@example.com' } },
            { uuid: 'no-es-un-uuid' },
            { paymentForm: '4' },
            { cfdiUse: 'GASTOS' },
            { total: -1 },
            { saveTaxProfile: {} },
            { saveTaxProfile: { email: 'no-es-correo' } },
          ];

          for (const extra of wrong) {
            await invoice(invoiceBody(code, extra)).expect(400);
          }
          expect(await invoicesOf(code)).toHaveLength(0);
        });

        it('the panel sees the payments and invoices of the day', async () => {
          const code = await openFor(nextPhone());
          await askBill(code).expect(200);
          await sendLink(code);
          const operation = paymentId();
          await pay(operation, 50, code).expect(201);
          const body = invoiceBody(code);
          await invoice(body).expect(201);

          const url = `/v1/orders/billing?branchId=${seed.branchA.id}`;
          const res = await http().get(url).set(auth(ownerToken)).expect(200);
          const day = res.body as {
            date: string;
            payments: { providerPaymentId: string }[];
            invoices: { folio: string }[];
          };

          expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(
            day.payments.find((p) => p.providerPaymentId === operation),
          ).toMatchObject({
            orderCode: code,
            table: 'A5',
            status: 'approved',
            paidAmount: 50,
          });
          const issued = day.invoices.find((i) => i.folio === body.folio);
          expect(issued).toMatchObject({
            orderCode: code,
            table: 'A5',
            rfc: 'XAXX010101000',
            total: 50,
            emailSent: true,
          });
          expect(issued).not.toHaveProperty('email');

          await expect(
            http()
              .get(`${url}&date=2020-01-01`)
              .set(auth(ownerToken))
              .expect(200)
              .then((r) => r.body as unknown),
          ).resolves.toEqual({
            date: '2020-01-01',
            payments: [],
            invoices: [],
          });

          await http()
            .get(`${url}&date=2026-02-30`)
            .set(auth(ownerToken))
            .expect(400);
          await http().get(url).set(auth(otherToken)).expect(403);
        });
      });

      describe('daily close', () => {
        const dailyClose = (key = secret) =>
          http()
            .post('/v1/bot/daily-close')
            .set({ 'X-BotBite-Key': key })
            .expect(200);

        it('closes only the WhatsApp accounts nobody asked for', async () => {
          // Lo que dejaron abierto las pruebas anteriores no estorba aquí.
          await dailyClose();

          const open = await openFor(nextPhone());
          const billed = await openFor(nextPhone());
          await askBill(billed).expect(200);
          const tab = await http()
            .post('/v1/orders/tabs')
            .set(auth(ownerToken))
            .send({
              branchId: seed.branchA.id,
              table: '9',
              items: [item()],
            })
            .expect(201);

          const res = await dailyClose();

          expect(res.body.closed).toEqual([open]);

          const closed = await orderOf(open);
          expect(closed.status).toBe('auto_closed');
          expect(closed.closedAt).not.toBeNull();
          expect((await orderOf(billed)).status).toBe('bill_requested');

          const active = await activeOrders();
          expect(active.some((o) => o.id === tab.body.order.id)).toBe(true);
          expect(active.some((o) => o.code === open)).toBe(false);

          const alerts = await dataSource
            .getRepository(CashierNotification)
            .findBy({
              branchId: seed.branchA.id,
              message: Like('%Cierre diario: 1 cuenta(s)%'),
            });
          expect(alerts).toHaveLength(1);
          expect(alerts[0].type).toBe('alert');
        });

        it('does nothing when repeated and respects the branch', async () => {
          const open = await openFor(nextPhone());

          const other = await dailyClose(otherSecret);
          expect(other.body.closed).toEqual([]);
          expect((await orderOf(open)).status).toBe('open');

          await dailyClose();
          const notifications = dataSource.getRepository(CashierNotification);
          const before = await notifications.countBy({
            branchId: seed.branchA.id,
          });

          const again = await dailyClose();

          expect(again.body.closed).toEqual([]);
          expect(
            await notifications.countBy({ branchId: seed.branchA.id }),
          ).toBe(before);
        });

        it('stays closed to the new routes without a key', async () => {
          await http().post('/v1/bot/daily-close').expect(401);
          await http().post('/v1/bot/payments').send({}).expect(401);
          await http().post('/v1/bot/customers/lookup').send({}).expect(401);
        });
      });
    });

    describe('events to the waiter service', () => {
      interface ReceivedEvent {
        type: string;
        branchId: string;
        restaurantSlug: string;
        branchSlug: string;
        data: Record<string, unknown>;
      }
      const received: ReceivedEvent[] = [];
      const invalid: string[] = [];
      let server: Server;

      const waitForEvent = async (type: string, ms = 6000) => {
        const start = Date.now();
        while (Date.now() - start < ms) {
          const event = received.find((e) => e.type === type);
          if (event) return event;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(`Event not received: ${type}`);
      };

      beforeAll(async () => {
        // Hace del mesero: recibe los avisos y valida su firma.
        server = createServer((req, res) => {
          let body = '';
          req.setEncoding('utf8');
          req.on('data', (chunk: string) => (body += chunk));
          req.on('end', () => {
            const timestamp = req.headers['x-botbite-timestamp'] as string;
            const expected = signBotEvent(
              process.env.BOT_WEBHOOK_SECRET!,
              timestamp,
              body,
            );
            if (
              req.url !==
                '/webhook/mesero-centro/portal-evento?negocio=tacos' ||
              req.headers['x-botbite-signature'] !== expected
            ) {
              invalid.push(body);
            }
            received.push(JSON.parse(body) as ReceivedEvent);
            res.end('ok');
          });
        });
        await new Promise<void>((resolve) => server.listen(0, resolve));

        const { port } = server.address() as AddressInfo;
        await dataSource.getRepository(Branch).update(
          { id: seed.branchA.id },
          {
            botBaseUrl: `http://127.0.0.1:${port}/webhook/mesero-centro?negocio=tacos`,
          },
        );
      });

      afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
        await dataSource
          .getRepository(Branch)
          .update({ id: seed.branchA.id }, { botBaseUrl: null });
      });

      beforeEach(() => {
        received.length = 0;
      });

      it('tells the bot when a round changes, so the diner gets a message', async () => {
        const code = nextCode();
        await openAccount(code, { language: 'en' }).expect(201);

        await http()
          .patch(`/v1/orders/rounds/${await roundIdOf(code, 1)}`)
          .set(auth(ownerToken))
          .send({ status: 'preparing' })
          .expect(200);

        const event = await waitForEvent('round.status_changed');
        expect(event.branchId).toBe(seed.branchA.id);
        const branch = await dataSource.getRepository(Branch).findOneOrFail({
          where: { id: seed.branchA.id },
          relations: { restaurant: true },
        });
        expect(event.restaurantSlug).toBe(branch.restaurant.slug);
        expect(event.branchSlug).toBe(branch.slug);
        expect(invalid).toEqual([]);
        expect(event.data).toEqual({
          orderCode: code,
          roundNumber: 1,
          status: 'preparing',
          table: 'A5',
          language: 'en',
          phone: `+${PHONE}`,
        });
      });

      it('tells the bot when the cashier closes an account', async () => {
        const code = nextCode();
        const { body } = await openAccount(code).expect(201);

        await http()
          .post(`/v1/orders/${body.order.id}/settle`)
          .set(auth(ownerToken))
          .expect(200);

        const event = await waitForEvent('order.closed');
        expect(event.data).toEqual({
          orderCode: code,
          status: 'settled',
          phone: `+${PHONE}`,
        });
      });

      it('does not announce accounts opened by staff', async () => {
        const res = await http()
          .post('/v1/orders/tabs')
          .set(auth(ownerToken))
          .send({ branchId: seed.branchA.id, table: '1', items: [item()] })
          .expect(201);

        await http()
          .post(`/v1/orders/${res.body.order.id}/settle`)
          .set(auth(ownerToken))
          .expect(200);

        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(received.some((e) => e.type === 'order.closed')).toBe(false);
      });

      it('announces catalog changes once per burst', async () => {
        const url = `/v1/menus/menu/${seed.menu.id}/items/${seed.menuItem.id}`;

        for (const price of [26, 27, 25]) {
          await http()
            .patch(url)
            .set(auth(ownerToken))
            .send({ price })
            .expect(200);
        }

        await waitForEvent('catalog.changed');
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(
          received.filter((e) => e.type === 'catalog.changed'),
        ).toHaveLength(1);
      });

      it('every event carried a valid signature', () => {
        expect(invalid).toEqual([]);
      });
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

    /** Un evento llega al socket en menos de `ms`, o no. */
    const receives = (socket: Socket, event: string, ms = 1500) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          socket.off(event, onEvent);
          resolve(false);
        }, ms);
        const onEvent = () => {
          clearTimeout(timer);
          resolve(true);
        };
        socket.once(event, onEvent);
      });

    const disconnects = (socket: Socket, ms = 3000) =>
      new Promise<string | null>((resolve) => {
        if (socket.disconnected) return resolve('already');
        const timer = setTimeout(() => resolve(null), ms);
        socket.once('disconnect', (reason) => {
          clearTimeout(timer);
          resolve(reason);
        });
      });

    /** Cambia el aviso de la semilla para que la sala reciba un evento. */
    let notificationRead = false;
    const touchNotification = async (token: string) => {
      notificationRead = !notificationRead;
      await http()
        .patch(
          `/v1/notifications/${seed.notification.id}/${notificationRead ? 'read' : 'unread'}`,
        )
        .set(auth(token))
        .expect(200);
    };

    /** Un cajero nuevo, asignado a la sucursal A. */
    const newStaffInBranchA = async (email: string) => {
      const admin = await tokenFor(seed.superUser.email);
      const created = await http()
        .post('/v1/users/register-user')
        .set(auth(admin))
        .send({ email, password: PASSWORD })
        .expect(201);
      await http()
        .post(`/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/staff`)
        .set(auth(await tokenFor(seed.clientA.email)))
        .send({ email })
        .expect(201);
      return {
        id: created.body.user.id as string,
        // Sin login: el login está limitado a 20 por minuto por IP.
        token: app
          .get(JwtService)
          .sign(
            { userId: created.body.user.id as string, type: 'access' },
            { expiresIn: '15m' },
          ),
      };
    };

    it('closes the connection when the access token expires (#37)', async () => {
      const token = app
        .get(JwtService)
        .sign({ userId: seed.clientA.id, type: 'access' }, { expiresIn: '2s' });
      const socket = await connect(token);

      expect(await disconnects(socket, 4000)).toBe('io server disconnect');
      socket.close();
    });

    it('a staff member removed from the branch stops receiving its events (#37)', async () => {
      const staff = await newStaffInBranchA('socket-removido@botbite.test');
      const owner = await tokenFor(seed.clientA.email);
      const socket = await connect(staff.token);
      await socket.emitWithAck('joinBranch', seed.branchA.id);

      const before = receives(socket, 'notificationUpdate');
      await touchNotification(owner);
      expect(await before).toBe(true);

      await http()
        .delete(
          `/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/staff/${staff.id}`,
        )
        .set(auth(owner))
        .expect(204);

      const after = receives(socket, 'notificationUpdate');
      await touchNotification(owner);
      expect(await after).toBe(false);

      // Tampoco puede volver a entrar a la sala.
      const rejoin = (await socket.emitWithAck(
        'joinBranch',
        seed.branchA.id,
      )) as {
        success: boolean;
      };
      expect(rejoin.success).toBe(false);
      socket.close();
    });

    it('a deactivated user is disconnected right away (#37)', async () => {
      const staff = await newStaffInBranchA('socket-desactivado@botbite.test');
      const socket = await connect(staff.token);
      await socket.emitWithAck('joinBranch', seed.branchA.id);

      const closed = disconnects(socket);
      await http()
        .delete(`/v1/users/deactivate-user/${staff.id}`)
        .set(auth(await tokenFor(seed.superUser.email)))
        .expect(200);

      expect(await closed).toBe('io server disconnect');
      // Y ya no puede volver a conectar con su token.
      await expect(connect(staff.token)).rejects.toThrow('Unauthorized');
    });

    it('no longer accepts the token in the query string (#37)', async () => {
      const token = await tokenFor(seed.clientA.email);
      const attempt = new Promise<Socket>((resolve, reject) => {
        const socket = io(`${baseUrl}/orders`, {
          transports: ['websocket'],
          query: { token },
          reconnection: false,
        });
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', (error) => {
          socket.close();
          reject(error);
        });
      });
      await expect(attempt).rejects.toThrow('Unauthorized');
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

  describe('menu CSV', () => {
    let menu: Menu;
    const BOM = String.fromCharCode(0xfeff);
    const csvFile = (text: string) => Buffer.from(text, 'utf8');
    const ownPhoto = 'https://res.cloudinary.com/e2e/image/upload/v1/own.jpg';

    const upload = (path: string, token: string, text: string) =>
      http()
        .post(`/v1/menus/menu/${menu.id}/${path}`)
        .set(auth(token))
        .attach('file', csvFile(text), {
          filename: 'menu.csv',
          contentType: 'text/csv',
        });

    const itemsOf = () =>
      dataSource.getRepository(MenuItem).find({
        where: { menuId: menu.id },
        relations: { product: true, category: true },
        order: { sortOrder: 'ASC' },
      });

    beforeAll(async () => {
      menu = await dataSource
        .getRepository(Menu)
        .save({ name: 'Menú CSV', branchId: seed.branchB.id });
    });

    it('previews without saving anything', async () => {
      const token = await tokenFor(seed.clientB.email);
      const events = jest.spyOn(app.get(BotEventsService), 'catalogChanged');
      const before = await dataSource.getRepository(Product).count();

      const res = await upload(
        'import/preview',
        token,
        `${BOM}Nombre;Descripción;Categoría;Precio;Familia;Recomendado;Activo;Foto URL;Costo\r\n` +
          'Roll California;Con aguacate;Rollos;120,50;Rollos;sí;;https://example.com/a.jpg;10\r\n' +
          'ajeno;;Ajenos;99;;;no;;\r\n' +
          'Agua de jamaica;;Bebidas frías;35;;;;;\r\n',
      ).expect(200);

      expect(res.body.errors).toEqual([]);
      expect(res.body.summary).toEqual({
        rows: 3,
        categoriesToCreate: 2,
        productsToCreate: 2,
        productsToAdd: 1,
        productsToUpdate: 0,
        photosToCopy: 1,
      });
      expect(res.body.categoriesToCreate).toEqual(['ROLLOS', 'BEBIDAS FRÍAS']);
      expect(res.body.rows).toEqual([
        {
          row: 2,
          name: 'ROLL CALIFORNIA',
          category: 'ROLLOS',
          price: 120.5,
          action: 'create',
          photo: 'copy',
        },
        {
          row: 3,
          name: 'AJENO',
          category: 'AJENOS',
          price: 99,
          action: 'add',
          photo: null,
        },
        {
          row: 4,
          name: 'AGUA DE JAMAICA',
          category: 'BEBIDAS FRÍAS',
          price: 35,
          action: 'create',
          photo: null,
        },
      ]);
      expect(res.body.warnings).toEqual([
        expect.objectContaining({ row: 1, column: null }),
      ]);

      expect(await dataSource.getRepository(Product).count()).toBe(before);
      expect(await itemsOf()).toEqual([]);
      expect(events).not.toHaveBeenCalled();
      events.mockRestore();
    });

    it('reports errors by row and column, and the import saves nothing', async () => {
      const token = await tokenFor(seed.clientB.email);
      const file =
        'nombre,categoria,precio,activo,foto_url\n' +
        'Taco,Tacos,abc,sí,\n' +
        ',Tacos,20,,\n' +
        'Gringa,Tacos,40,tal vez,http://example.com/g.jpg\n' +
        'gringa,Tacos,40,,\n';

      const preview = await upload('import/preview', token, file).expect(200);
      expect(
        preview.body.errors.map(
          (e: { row: number; column: string }) => `${e.row}:${e.column}`,
        ),
      ).toEqual(['2:precio', '3:nombre', '4:activo', '4:foto_url', '5:nombre']);
      expect(preview.body.errors[0].message).toContain('120.50');
      expect(preview.body.errors[4].message).toContain('4');

      const res = await upload('import', token, file).expect(400);
      expect(res.body.errors).toHaveLength(5);
      expect(await itemsOf()).toEqual([]);

      const missing = await upload(
        'import/preview',
        token,
        'nombre,precio\nTaco,10\n',
      ).expect(200);
      expect(missing.body.errors).toEqual([
        expect.objectContaining({ row: 1, column: 'categoria' }),
      ]);
    });

    it('imports in one go, copies the photos and notifies the bot once', async () => {
      const token = await tokenFor(seed.clientB.email);
      const events = jest.spyOn(app.get(BotEventsService), 'catalogChanged');

      const res = await upload(
        'import',
        token,
        'nombre,descripcion,categoria,precio,familia,recomendado,activo,foto_url\n' +
          'Roll California,Con aguacate,Rollos,120.50,Rollos,sí,,https://example.com/a.jpg\n' +
          'Roll Philadelphia,,Rollos,130,rollos,,no,https://example.com/rota.jpg\n' +
          `Ajeno,,Ajenos,99,,,,${ownPhoto}\n` +
          'Agua de jamaica,,Bebidas frías,35,,,,\n',
      ).expect(201);

      expect(res.body.summary).toMatchObject({
        productsToCreate: 3,
        productsToAdd: 1,
        photosToCopy: 2,
      });
      expect(res.body.message).toContain('3');
      expect(res.body.photoErrors).toEqual([
        expect.objectContaining({ row: 3, column: 'foto_url' }),
      ]);
      expect(events).toHaveBeenCalledTimes(1);
      expect(events).toHaveBeenCalledWith({ menuId: menu.id });
      events.mockRestore();

      const items = await itemsOf();
      const byName = new Map(items.map((item) => [item.product.name, item]));

      expect(byName.get('ROLL CALIFORNIA')).toMatchObject({
        price: '120.50',
        variantGroup: 'ROLLOS',
        shouldRecommend: true,
        isActive: true,
        sortOrder: 0,
        product: {
          description: 'CON AGUACATE',
          imageUrl: expect.stringContaining('/product-'),
        },
        category: { name: 'ROLLOS' },
      });
      expect(byName.get('ROLL PHILADELPHIA')).toMatchObject({
        variantGroup: 'ROLLOS',
        shouldRecommend: false,
        isActive: false,
        sortOrder: 1,
        product: { imageUrl: null },
      });
      expect(byName.get('AJENO')).toMatchObject({
        product: { id: seed.foreignMenuItem.productId, imageUrl: ownPhoto },
        category: { name: 'AJENOS' },
      });

      const categories = await dataSource
        .getRepository(Category)
        .find({ where: { restaurantId: seed.restaurantB.id } });
      const lastExisting = Math.max(
        ...categories
          .filter((c) => !['ROLLOS', 'BEBIDAS FRÍAS'].includes(c.name))
          .map((c) => c.sortOrder),
      );
      expect(categories.find((c) => c.name === 'ROLLOS')?.sortOrder).toBe(
        lastExisting + 1,
      );
      expect(
        categories.find((c) => c.name === 'BEBIDAS FRÍAS')?.sortOrder,
      ).toBe(lastExisting + 2);
    });

    it('updates by name and keeps what is not in the file', async () => {
      const token = await tokenFor(seed.clientB.email);
      const productsBefore = await dataSource.getRepository(Product).count();

      const preview = await upload(
        'import/preview',
        token,
        'nombre,categoria,precio,activo\n' +
          'roll   philadelphia,Rollos,140,sí\n' +
          'Roll  Califórnia,Rollos,125,\n',
      ).expect(200);
      expect(
        preview.body.rows.map((r: { action: string }) => r.action),
      ).toEqual(['update', 'update']);

      await upload(
        'import',
        token,
        'nombre,categoria,precio,activo\n' +
          'roll   philadelphia,Rollos,140,sí\n' +
          'Roll  Califórnia,Rollos,125,\n',
      ).expect(201);

      const items = await itemsOf();
      const byName = new Map(items.map((item) => [item.product.name, item]));

      expect(await dataSource.getRepository(Product).count()).toBe(
        productsBefore,
      );
      expect(byName.get('ROLL PHILADELPHIA')).toMatchObject({
        price: '140.00',
        isActive: true,
        sortOrder: 0,
      });
      // Lo que no viene en la celda (o en el archivo) se queda igual.
      expect(byName.get('ROLL CALIFORNIA')).toMatchObject({
        price: '125.00',
        variantGroup: 'ROLLOS',
        shouldRecommend: true,
        sortOrder: 1,
        product: { description: 'CON AGUACATE' },
      });
      expect(byName.get('AGUA DE JAMAICA')).toMatchObject({ price: '35.00' });
    });

    it('warns when a new product looks like one that left the file', async () => {
      const token = await tokenFor(seed.clientB.email);

      const res = await upload(
        'import/preview',
        token,
        'nombre,categoria,precio\n' +
          'Roll Californias,Rollos,125\n' +
          'Roll Philadelphia,Rollos,140\n',
      ).expect(200);

      expect(res.body.errors).toEqual([]);
      expect(res.body.warnings).toEqual([
        expect.objectContaining({
          row: 2,
          column: 'nombre',
          message: expect.stringContaining('ROLL CALIFORNIA'),
        }),
      ]);
    });

    it('exports the menu in the format it imports', async () => {
      const token = await tokenFor(seed.clientB.email);

      const res = await http()
        .get(`/v1/menus/menu/${menu.id}/export`)
        .set(auth(token))
        .buffer(true)
        .parse((response, done) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('-menu-csv.csv');

      const text = (res.body as Buffer).toString('utf8');
      const lines = text.split('\r\n');
      expect(text.startsWith(BOM)).toBe(true);
      expect(lines[0]).toBe(
        `${BOM}nombre,descripcion,categoria,precio,familia,recomendado,activo,foto_url`,
      );
      expect(lines.slice(1, 5)).toEqual([
        `AJENO,,AJENOS,99.00,,no,sí,${ownPhoto}`,
        'ROLL PHILADELPHIA,,ROLLOS,140.00,ROLLOS,no,sí,',
        expect.stringMatching(
          /^ROLL CALIFORNIA,CON AGUACATE,ROLLOS,125\.00,ROLLOS,sí,sí,https:/,
        ),
        'AGUA DE JAMAICA,,BEBIDAS FRÍAS,35.00,,no,sí,',
      ]);

      // Lo exportado se vuelve a importar sin errores ni cambios de producto.
      const again = await upload('import/preview', token, text).expect(200);
      expect(again.body.errors).toEqual([]);
      expect(again.body.summary).toMatchObject({
        productsToCreate: 0,
        productsToAdd: 0,
        productsToUpdate: 4,
        photosToCopy: 0,
      });
    });

    it('another client cannot import or export it', async () => {
      const other = await tokenFor(seed.clientA.email);
      const file = 'nombre,categoria,precio\nTaco,Tacos,10\n';

      await upload('import/preview', other, file).expect(403);
      await upload('import', other, file).expect(403);
      await http()
        .get(`/v1/menus/menu/${menu.id}/export`)
        .set(auth(other))
        .expect(403);
    });

    it('rejects files that are not text', async () => {
      const token = await tokenFor(seed.clientB.email);

      await http()
        .post(`/v1/menus/menu/${menu.id}/import/preview`)
        .set(auth(token))
        .attach('file', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), {
          filename: 'menu.csv',
          contentType: 'text/csv',
        })
        .expect(400);
    });
  });

  describe('customers screen', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
    const url = () => `/v1/restaurants/${seed.restaurantB.id}/customers`;
    const ids: Record<string, string> = {};

    const list = async (query = '') => {
      const token = await tokenFor(seed.clientB.email);
      return http().get(`${url()}${query}`).set(auth(token)).expect(200);
    };
    const names = (body: unknown) =>
      (body as { customers: { name: string }[] }).customers.map((c) => c.name);

    beforeAll(async () => {
      const customers = dataSource.getRepository(Customer);
      const memberships = dataSource.getRepository(RestaurantCustomer);
      const orders = dataSource.getRepository(Order);
      const rounds = dataSource.getRepository(OrderRound);
      const items = dataSource.getRepository(OrderItem);
      const restaurantId = seed.restaurantB.id;

      const people = [
        // Recurrente: 2 cuentas pagadas, una cancelada y cashback.
        {
          name: 'Ana',
          phone: '+5216779900001',
          visits: 3,
          first: 90,
          last: 2,
          promos: PromosStatus.ACCEPTED,
          unsubscribed: false,
          wallet: 10,
        },
        {
          name: 'Beto',
          phone: '+5216779900002',
          visits: 1,
          first: 0,
          last: 0,
          promos: PromosStatus.PENDING,
          unsubscribed: false,
          wallet: 0,
        },
        // Inactivo y dado de baja, aunque había aceptado.
        {
          name: 'Caro',
          phone: '+5216779900003',
          visits: 2,
          first: 100,
          last: 45,
          promos: PromosStatus.DECLINED,
          unsubscribed: true,
          wallet: 0,
        },
        {
          name: 'Dani',
          phone: '+5216779900004',
          visits: 2,
          first: 60,
          last: 5,
          promos: PromosStatus.DECLINED,
          unsubscribed: false,
          wallet: 0,
        },
      ];

      for (const person of people) {
        const customer = await customers.save(
          customers.create({ name: person.name, phone: person.phone }),
        );
        const membership = await memberships.save(
          memberships.create({
            restaurantId,
            customerId: customer.id,
            visits: person.visits,
            firstVisitAt: daysAgo(person.first),
            lastVisitAt: daysAgo(person.last),
            promos: person.promos,
            promosAt: daysAgo(person.last),
            unsubscribedAt: person.unsubscribed ? daysAgo(40) : null,
            walletBalance: person.wallet,
          }),
        );
        ids[person.name] = membership.id;
        ids[`${person.name}.customer`] = customer.id;
      }

      const order = (status: OrderStatus, total: number) =>
        orders.save(
          orders.create({
            branchId: seed.branchB.id,
            customerId: ids['Ana.customer'],
            status,
            subtotal: total,
            total,
            tip: 20,
          }),
        );
      const round = (orderId: string, number: number, status: RoundStatus) =>
        rounds.save(rounds.create({ orderId, number, status }));
      const item = (
        orderId: string,
        roundId: string,
        productName: string,
        quantity: number,
      ) =>
        items.save(
          items.create({
            orderId,
            roundId,
            productName,
            quantity,
            price: 10,
            menuItemId: seed.foreignMenuItem.id,
          }),
        );

      const first = await order(OrderStatus.PAID, 100);
      const firstRound = await round(first.id, 1, RoundStatus.DELIVERED);
      await item(first.id, firstRound.id, 'TACO', 3);
      await item(first.id, firstRound.id, 'AGUA', 1);

      const second = await order(OrderStatus.SETTLED, 200);
      const delivered = await round(second.id, 1, RoundStatus.DELIVERED);
      const cancelled = await round(second.id, 2, RoundStatus.CANCELLED);
      await item(second.id, delivered.id, 'TACO', 1);
      await item(second.id, delivered.id, 'TORTA', 1);
      await item(second.id, cancelled.id, 'POSTRE', 5);

      // Una cuenta cancelada no cuenta como gasto.
      const lost = await order(OrderStatus.CANCELLED, 999);
      const lostRound = await round(lost.id, 1, RoundStatus.NEW);
      await item(lost.id, lostRound.id, 'POSTRE', 9);

      await dataSource.getRepository(WalletMovement).save([
        {
          type: WalletMovementType.CASHBACK,
          amount: 5,
          balanceAfter: 5,
          restaurantCustomerId: ids['Ana'],
          orderId: first.id,
        },
        {
          type: WalletMovementType.CASHBACK,
          amount: 7.5,
          balanceAfter: 12.5,
          restaurantCustomerId: ids['Ana'],
          orderId: second.id,
        },
        {
          type: WalletMovementType.USE,
          amount: -2.5,
          balanceAfter: 10,
          restaurantCustomerId: ids['Ana'],
          orderId: second.id,
        },
      ]);
    });

    it('shows visits, spending, cashback, promotions, status and favorites', async () => {
      const res = await list('?sort=name&order=asc');

      expect(res.body.total).toBe(4);
      expect(res.body.totals).toEqual({
        customers: 4,
        newThisMonth: 1,
        recurring: 1,
        promosAccepted: 1,
      });
      expect(res.body.exportEnabled).toBe(true);
      expect(names(res.body)).toEqual(['Ana', 'Beto', 'Caro', 'Dani']);

      const [ana, beto, caro, dani] = res.body.customers;
      expect(ana).toMatchObject({
        id: ids['Ana'],
        phone: '+521••••••••01',
        visits: 3,
        spent: 300,
        paidOrders: 2,
        avgTicket: 150,
        walletBalance: 10,
        cashbackEarned: 12.5,
        promos: 'accepted',
        status: 'recurring',
        favorites: ['TACO', 'AGUA', 'TORTA'],
      });
      expect(beto).toMatchObject({
        status: 'new',
        promos: 'pending',
        spent: 0,
        favorites: [],
      });
      expect(caro).toMatchObject({
        status: 'inactive',
        promos: 'unsubscribed',
      });
      expect(dani).toMatchObject({ status: 'occasional', promos: 'declined' });
      expect(JSON.stringify(res.body)).not.toContain('+5216779900001');
    });

    it('filters, searches, sorts and pages on the server', async () => {
      expect(names((await list('?status=inactive')).body)).toEqual(['Caro']);
      expect(names((await list('?promos=accepted')).body)).toEqual(['Ana']);
      expect(names((await list('?search=bet')).body)).toEqual(['Beto']);
      expect(names((await list('?search=9900003')).body)).toEqual(['Caro']);
      expect(names((await list('?search=%25')).body)).toEqual([]);
      expect(names((await list('?sort=spent&order=desc')).body)[0]).toBe('Ana');
      expect(names((await list('?sort=status&order=desc')).body)[0]).toBe(
        'Caro',
      );

      const page = await list('?sort=name&order=asc&limit=2&offset=2');
      expect(names(page.body)).toEqual(['Caro', 'Dani']);
      expect(page.body.total).toBe(4);

      const owner = await tokenFor(seed.clientB.email);
      await http().get(`${url()}?status=vip`).set(auth(owner)).expect(400);
      await http().get(`${url()}?sort=phone`).set(auth(owner)).expect(400);
    });

    it('shows a full phone only on request, and records who saw it', async () => {
      const owner = await tokenFor(seed.clientB.email);
      const other = await tokenFor(seed.clientA.email);
      const phoneUrl = `${url()}/${ids['Dani']}/phone`;

      const res = await http().post(phoneUrl).set(auth(owner)).expect(200);
      expect(res.body).toEqual({ phone: '+5216779900004' });

      await http().post(phoneUrl).set(auth(other)).expect(403);
      await http().get(url()).set(auth(other)).expect(403);
      // Un cliente de otro restaurante no se encuentra por este.
      await http()
        .post(
          `/v1/restaurants/${seed.restaurantB.id}/customers/${randomUUID()}/phone`,
        )
        .set(auth(owner))
        .expect(404);

      const logs = await dataSource
        .getRepository(AuditLog)
        .findBy({ subjectId: ids['Dani'] });
      expect(logs).toEqual([
        expect.objectContaining({
          userId: seed.clientB.id,
          restaurantId: seed.restaurantB.id,
          action: 'customer.phone_viewed',
          recordCount: 1,
        }),
      ]);
      expect(JSON.stringify(logs)).not.toContain('+521');
    });

    it('exports the full phone only of who accepted promotions', async () => {
      const owner = await tokenFor(seed.clientB.email);
      const exportCsv = (query = '') =>
        http()
          .get(`${url()}/export${query}`)
          .set(auth(owner))
          .buffer(true)
          .parse((response, done) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => done(null, Buffer.concat(chunks)));
          });

      const res = await exportCsv('?sort=name&order=asc').expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = (res.body as Buffer).toString('utf8').split('\r\n');

      expect(lines[0]).toContain('nombre,telefono,visitas');
      expect(lines[1]).toMatch(/^Ana,\+5216779900001,3,/);
      expect(lines[1]).toContain(',aceptó,');
      expect(lines[1]).toContain('TACO | AGUA | TORTA');
      expect(lines[3]).toMatch(/^Caro,\+521••••••••03,/);
      expect(lines.filter(Boolean)).toHaveLength(5);

      const accepted = await exportCsv('?promos=accepted').expect(200);
      expect(
        (accepted.body as Buffer)
          .toString('utf8')
          .split('\r\n')
          .filter(Boolean),
      ).toHaveLength(2);

      const exports = await dataSource.getRepository(AuditLog).find({
        where: {
          restaurantId: seed.restaurantB.id,
          action: 'customers.exported' as AuditLog['action'],
        },
        order: { createdAt: 'ASC' },
      });
      expect(exports.map((log) => log.recordCount)).toEqual([4, 1]);
    });

    it('does not export until it is switched on', async () => {
      const owner = await tokenFor(seed.clientB.email);
      const switchOff = jest
        .spyOn(app.get(CustomerReportService), 'exportEnabled', 'get')
        .mockReturnValue(false);

      try {
        await http().get(`${url()}/export`).set(auth(owner)).expect(403);
        expect((await list()).body.exportEnabled).toBe(false);
      } finally {
        switchOff.mockRestore();
      }
    });
  });
  describe('ordering (pickup and delivery)', () => {
    const WAITER_NUMBER = '555000111222';
    const ORDERING_NUMBER = '777000111222';
    const orderingUrl = (restaurantId: string, branchId: string) =>
      `/v1/branches/${restaurantId}/${branchId}/ordering`;
    const urlA = () => orderingUrl(seed.restaurantA.id, seed.branchA.id);
    const urlB = () => orderingUrl(seed.restaurantB.id, seed.branchB.id);
    let botKeyA: string;
    let botKeyB: string;

    const createKey = async (restaurantId: string, branchId: string) => {
      const admin = await tokenFor(seed.superUser.email);
      const created = await http()
        .post(`/v1/branches/${restaurantId}/${branchId}/bot-keys`)
        .set(auth(admin))
        .send({ name: 'pedidos' })
        .expect(201);
      return created.body.secret as string;
    };

    const fullConfig = {
      enabled: true,
      phoneNumberId: ORDERING_NUMBER,
      phoneNumber: '+5216441110000',
      types: ['pickup', 'delivery'],
      delivery: { baseFee: 30, includedKm: 4, extraPer100m: 1, maxKm: 8.5 },
      noDeliveryZones: [
        {
          name: 'Colonia X (de noche)',
          latitude: '27.5200123',
          longitude: -109.94,
          radiusMeters: 500,
          days: [6, 5],
          from: '21:00',
          to: '06:00',
        },
        {
          name: 'Zona cerrada siempre',
          latitude: 27.45,
          longitude: -109.94,
          radiusMeters: 300,
        },
      ],
      hours: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '18:00', closes: '23:00' }],
      scheduling: { enabled: true },
      commissionPct: 0.5,
    };

    beforeAll(async () => {
      // Pruebas anteriores apagan la sucursal B; su llave necesita que esté activa.
      await dataSource
        .getRepository(Restaurant)
        .update({ id: seed.restaurantB.id }, { isActive: true });
      await dataSource
        .getRepository(Branch)
        .update({ id: seed.branchB.id }, { isActive: true });
      // Sin avisos al mesero y con un número de mesero conocido.
      await dataSource.getRepository(Branch).update(
        { id: seed.branchA.id },
        {
          botBaseUrl: null,
          whatsappPhoneNumberId: WAITER_NUMBER,
          verifyLocation: false,
          latitude: null,
          longitude: null,
        },
      );
      botKeyA = await createKey(seed.restaurantA.id, seed.branchA.id);
      botKeyB = await createKey(seed.restaurantB.id, seed.branchB.id);
    });

    it('starts without ordering, for the panel and for the bot', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const panel = await http().get(urlA()).set(auth(owner)).expect(200);
      expect(panel.body).toEqual({ ordering: null });

      const bot = await http()
        .get('/v1/bot/branch')
        .set('X-BotBite-Key', botKeyA)
        .expect(200);
      expect(bot.body.branch.ordering).toBeNull();
    });

    it('keeps other restaurants out', async () => {
      const otherOwner = await tokenFor(seed.clientB.email);
      await http().get(urlA()).set(auth(otherOwner)).expect(403);
      await http()
        .patch(urlA())
        .set(auth(otherOwner))
        .send({ prepMinutes: 30 })
        .expect(403);
    });

    it('lets only BotBite enable it, set its number and the commission', async () => {
      const owner = await tokenFor(seed.clientA.email);
      for (const body of [
        { enabled: true },
        { phoneNumberId: ORDERING_NUMBER },
        { phoneNumber: '5216441110000' },
        { commissionPct: 1 },
      ]) {
        await http().patch(urlA()).set(auth(owner)).send(body).expect(403);
      }
    });

    it('needs the number to enable it and coordinates to deliver', async () => {
      const admin = await tokenFor(seed.superUser.email);
      const noNumber = await http()
        .patch(urlA())
        .set(auth(admin))
        .send({ enabled: true })
        .expect(400);
      expect(noNumber.body.message).toContain('phoneNumberId and phoneNumber');

      const noCoordinates = await http()
        .patch(urlA())
        .set(auth(admin))
        .send(fullConfig)
        .expect(400);
      expect(noCoordinates.body.message).toContain('latitude and longitude');
      expect(
        (await http().get(urlA()).set(auth(admin)).expect(200)).body.ordering,
      ).toBeNull();
    });

    it('saves the settings and the bot reads them in branch.ordering', async () => {
      await dataSource
        .getRepository(Branch)
        .update(
          { id: seed.branchA.id },
          { latitude: 27.535038, longitude: -109.954031 },
        );
      const admin = await tokenFor(seed.superUser.email);
      const saved = await http()
        .patch(urlA())
        .set(auth(admin))
        .send(fullConfig)
        .expect(200);

      const expected = {
        enabled: true,
        accepting: true,
        phoneNumberId: ORDERING_NUMBER,
        // WhatsApp lo muestra sin "+"; el 1 se respeta.
        phoneNumber: '5216441110000',
        types: ['pickup', 'delivery'],
        delivery: { baseFee: 30, includedKm: 4, extraPer100m: 1, maxKm: 8.5 },
        noDeliveryZones: [
          {
            name: 'Colonia X (de noche)',
            latitude: 27.520012,
            longitude: -109.94,
            radiusMeters: 500,
            days: [5, 6],
            from: '21:00',
            to: '06:00',
          },
          {
            name: 'Zona cerrada siempre',
            latitude: 27.45,
            longitude: -109.94,
            radiusMeters: 300,
            days: [],
            from: null,
            to: null,
          },
        ],
        hours: [
          { days: [0, 1, 2, 3, 4, 5, 6], opens: '18:00', closes: '23:00' },
        ],
        scheduling: {
          enabled: true,
          maxDays: 1,
          minLeadMinutes: 45,
          stepMinutes: 30,
          reminderMinutes: 30,
          cancelUntilMinutes: 60,
        },
        commissionPct: 0.5,
        paymentLinkMinutes: 60,
        prepMinutes: 20,
      };
      expect(saved.body.ordering).toEqual(expected);

      const bot = await http()
        .get('/v1/bot/branch')
        .set('X-BotBite-Key', botKeyA)
        .expect(200);
      expect(bot.body.branch.ordering).toEqual(expected);
    });

    it('lets the owner adjust fees and hours, replacing whole lists', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const res = await http()
        .patch(urlA())
        .set(auth(owner))
        .send({
          delivery: { baseFee: 35, maxKm: null },
          hours: [
            { days: [1, 2, 3, 4, 5], opens: '13:00', closes: '16:00' },
            { days: [5, 6], opens: '19:00', closes: '01:00' },
          ],
          scheduling: { maxDays: 2 },
          prepMinutes: 25,
        })
        .expect(200);

      expect(res.body.ordering).toMatchObject({
        delivery: { baseFee: 35, includedKm: 4, extraPer100m: 1, maxKm: null },
        hours: [
          { days: [1, 2, 3, 4, 5], opens: '13:00', closes: '16:00' },
          { days: [5, 6], opens: '19:00', closes: '01:00' },
        ],
        scheduling: { enabled: true, maxDays: 2 },
        prepMinutes: 25,
        commissionPct: 0.5,
      });
      expect(res.body.ordering.noDeliveryZones).toHaveLength(2);
    });

    it('rejects zones, hours and types that the bot could not use', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const zone = { name: 'Z', latitude: 27.5, longitude: -109.9 };
      for (const body of [
        { noDeliveryZones: [{ ...zone, radiusMeters: 300, from: '21:00' }] },
        { noDeliveryZones: [{ ...zone, radiusMeters: 5 }] },
        { hours: [{ days: [1], opens: '18:00', closes: '18:00' }] },
        { hours: [{ days: [], opens: '18:00', closes: '23:00' }] },
        { hours: [{ days: [7], opens: '18:00', closes: '23:00' }] },
        { types: ['dine_in'] },
        { types: [] },
        { scheduling: { stepMinutes: 1 } },
      ]) {
        await http().patch(urlA()).set(auth(owner)).send(body).expect(400);
      }
    });

    it('keeps one WhatsApp number per branch and per mode', async () => {
      const admin = await tokenFor(seed.superUser.email);
      // El del mesero de la misma sucursal.
      await http()
        .patch(urlA())
        .set(auth(admin))
        .send({ phoneNumberId: WAITER_NUMBER })
        .expect(409);
      // El de pedidos de otra sucursal.
      await http()
        .patch(urlB())
        .set(auth(admin))
        .send({ phoneNumberId: ORDERING_NUMBER })
        .expect(409);
      // Como número del mesero de otra sucursal.
      await http()
        .patch(
          `/v1/branches/${seed.restaurantB.id}/${seed.branchB.id}/bot-config`,
        )
        .set(auth(admin))
        .send({ whatsappPhoneNumberId: ORDERING_NUMBER })
        .expect(409);
    });

    it('pauses and resumes from WhatsApp and from the panel', async () => {
      const paused = await http()
        .patch('/v1/bot/ordering')
        .set('X-BotBite-Key', botKeyA)
        .send({ accepting: false })
        .expect(200);
      expect(paused.body).toEqual({ accepting: false });

      const owner = await tokenFor(seed.clientA.email);
      expect(
        (await http().get(urlA()).set(auth(owner)).expect(200)).body.ordering
          .accepting,
      ).toBe(false);

      await http()
        .patch(`${urlA()}/accepting`)
        .set(auth(owner))
        .send({ accepting: true })
        .expect(200, { accepting: true });

      const bot = await http()
        .get('/v1/bot/branch')
        .set('X-BotBite-Key', botKeyA)
        .expect(200);
      expect(bot.body.branch.ordering.accepting).toBe(true);
    });

    it('answers 404 to a branch without ordering', async () => {
      await http()
        .patch('/v1/bot/ordering')
        .set('X-BotBite-Key', botKeyB)
        .send({ accepting: false })
        .expect(404);
      await http()
        .patch('/v1/bot/ordering')
        .set('X-BotBite-Key', botKeyA)
        .send({ accepting: 'no' })
        .expect(400);
    });
  });
  describe('pickup and delivery orders', () => {
    interface OrderBody {
      id: string;
      status: string;
      subtotal: number;
      total: number;
      walletDiscount: number;
      amountDue: number;
    }
    const ORDERS_URL = '/v1/bot/orders';
    const PHONE = '5215533330001';
    let botKey: string;
    let emitSpy: jest.SpyInstance;

    const bot = () => ({ 'X-BotBite-Key': botKey });
    const inAnHour = () => new Date(Date.now() + 60 * 60_000).toISOString();
    const delivery = {
      address: 'Calle 5 de Febrero 123, Centro',
      references: 'Portón negro',
      latitude: '27.4912001',
      longitude: -109.9381,
      fee: 42,
    };
    const items = () => [
      { menuItemId: seed.menuItem.id, quantity: 2, note: 'sin cebolla' },
    ];
    const openOrder = (body: object) =>
      http().post(ORDERS_URL).set(bot()).send(body);
    const orderOf = (code: string) =>
      dataSource.getRepository(Order).findOneByOrFail({ code });
    const membership = async () => {
      const customer = await dataSource
        .getRepository(Customer)
        .findOneByOrFail({ phone: `+${PHONE}` });
      return dataSource.getRepository(RestaurantCustomer).findOneByOrFail({
        customerId: customer.id,
        restaurantId: seed.restaurantA.id,
      });
    };
    const giveWallet = async (walletBalance: number) => {
      const { id } = await membership();
      await dataSource
        .getRepository(RestaurantCustomer)
        .update({ id }, { walletBalance });
    };
    const notificationsOf = (orderId: string) =>
      dataSource.getRepository(CashierNotification).find({
        where: { orderId },
        order: { createdAt: 'ASC' },
      });
    const panelUrl = (path: string) => `/v1/orders/${path}`;

    beforeAll(async () => {
      await dataSource
        .getRepository(BranchOrdering)
        .update(
          { branchId: seed.branchA.id },
          { enabled: true, types: [OrderType.PICKUP, OrderType.DELIVERY] },
        );
      await dataSource
        .getRepository(Restaurant)
        .update({ id: seed.restaurantA.id }, { walletPct: 10 });
      const branch = await dataSource
        .getRepository(Branch)
        .findOneByOrFail({ id: seed.branchA.id });
      await dataSource
        .getRepository(Branch)
        .update(
          { id: seed.branchA.id },
          { features: { ...branch.features, wallet: true } },
        );

      const admin = await tokenFor(seed.superUser.email);
      const created = await http()
        .post(`/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/bot-keys`)
        .set(auth(admin))
        .send({ name: 'pedidos' })
        .expect(201);
      botKey = created.body.secret as string;
      emitSpy = jest.spyOn(app.get(BotEventsService), 'emit');
    });

    afterAll(() => emitSpy.mockRestore());

    it('opens a delivery order without telling the cashier yet', async () => {
      const scheduledFor = inAnHour();
      const res = await openOrder({
        code: 'PED-0001',
        type: 'delivery',
        phone: PHONE,
        customerName: 'Ana',
        scheduledFor,
        delivery,
        commissionPct: 0.5,
        items: items(),
      }).expect(201);

      const order = res.body.order as OrderBody;
      expect(order).toMatchObject({
        type: 'delivery',
        status: 'open',
        table: null,
        fulfillmentStatus: null,
        scheduledFor,
        deliveryFee: 42,
        commissionPct: 0.5,
        delivery: {
          address: delivery.address,
          references: 'Portón negro',
          latitude: 27.4912,
          longitude: -109.9381,
        },
      });
      expect(order.amountDue).toBeCloseTo(order.subtotal + 42, 2);

      // Reintento: no duplica nada.
      await openOrder({
        code: 'PED-0001',
        type: 'delivery',
        phone: PHONE,
        delivery,
        items: items(),
      }).expect(200);

      expect(await notificationsOf(order.id)).toHaveLength(0);
      // Existe el cliente, pero la visita se cuenta al pagar.
      expect((await membership()).visits).toBe(0);

      const owner = await tokenFor(seed.clientA.email);
      const active = await http()
        .get(panelUrl(`active?branchId=${seed.branchA.id}`))
        .set(auth(owner))
        .expect(200);
      expect(
        active.body.orders.map((o: { code: string }) => o.code),
      ).not.toContain('PED-0001');
      const toDeliver = await http()
        .get(panelUrl(`to-deliver?branchId=${seed.branchA.id}`))
        .set(auth(owner))
        .expect(200);
      expect(toDeliver.body.total).toBe(0);
    });

    it('rejects orders that do not fit their type or the branch', async () => {
      const base = { phone: PHONE, items: items() };
      for (const body of [
        { ...base, code: 'BAD-0001', type: 'pickup', delivery },
        { ...base, code: 'BAD-0002', type: 'delivery' },
        {
          ...base,
          code: 'BAD-0003',
          type: 'dine_in',
          table: '1',
          scheduledFor: inAnHour(),
        },
        { ...base, code: 'BAD-0004', type: 'dine_in' },
        { ...base, code: 'BAD-0005', type: 'takeout' },
      ]) {
        await openOrder(body).expect(400);
      }

      await dataSource
        .getRepository(BranchOrdering)
        .update({ branchId: seed.branchA.id }, { types: [OrderType.DELIVERY] });
      await openOrder({ ...base, code: 'BAD-0006', type: 'pickup' }).expect(
        400,
      );
      await dataSource
        .getRepository(BranchOrdering)
        .update({ branchId: seed.branchA.id }, { enabled: false });
      await openOrder({
        ...base,
        code: 'BAD-0007',
        type: 'delivery',
        delivery,
      }).expect(409);
      await dataSource
        .getRepository(BranchOrdering)
        .update(
          { branchId: seed.branchA.id },
          { enabled: true, types: [OrderType.PICKUP, OrderType.DELIVERY] },
        );
    });

    it('uses the wallet with the link and charges the delivery fee', async () => {
      await giveWallet(20);
      const link = await http()
        .patch(`${ORDERS_URL}/PED-0001`)
        .set(bot())
        .send({ status: 'payment_link', walletUse: 'all' })
        .expect(200);

      const order = link.body.order as OrderBody;
      expect(order.status).toBe('payment_link');
      expect(order.walletDiscount).toBe(20);
      expect(order.total).toBeCloseTo(order.subtotal - 20, 2);
      expect(order.amountDue).toBeCloseTo(order.total + 42, 2);
      expect(link.body.walletBalance).toBe(0);
      expect(await notificationsOf(order.id)).toHaveLength(0);

      const paid = await http()
        .post('/v1/bot/payments')
        .set(bot())
        .send({
          orderCode: 'PED-0001',
          providerPaymentId: 'MP-PED-0001',
          amount: order.amountDue,
        })
        .expect(201);

      expect(paid.body.status).toBe('approved');
      // 10 % del consumo, sin el envío.
      expect(paid.body.cashback).toBeCloseTo(
        Math.round(order.total * 10) / 100,
        2,
      );

      const saved = await orderOf('PED-0001');
      expect(saved.status).toBe(OrderStatus.PAID);
      expect(saved.fulfillmentStatus).toBe(FulfillmentStatus.PENDING);
      expect((await membership()).visits).toBe(1);

      const [notice] = await notificationsOf(saved.id);
      expect(notice.type).toBe(NotificationType.ORDER);
      expect(notice.message).toContain('Pedido a domicilio pagado de Ana');
      expect(notice.message).toContain('⏰ Programado para');
      expect(notice.message).toContain('envío $42.00');
      expect(notice.message).not.toContain('Calle 5');
    });

    it('lists paid orders to deliver, with the address, outside Orders', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const res = await http()
        .get(panelUrl(`to-deliver?branchId=${seed.branchA.id}`))
        .set(auth(owner))
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.orders[0]).toMatchObject({
        code: 'PED-0001',
        type: 'delivery',
        fulfillmentStatus: 'pending',
        phone: `+${PHONE}`,
        delivery: { address: delivery.address },
      });
      expect(res.body.orders[0].rounds[0].items).toHaveLength(1);

      const otherOwner = await tokenFor(seed.clientB.email);
      await http()
        .get(panelUrl(`to-deliver?branchId=${seed.branchA.id}`))
        .set(auth(otherOwner))
        .expect(403);
    });

    it('moves the delivery from the panel and the bot, telling the bot only of panel changes', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const { id } = await orderOf('PED-0001');
      const move = (status: string) =>
        http()
          .patch(panelUrl(`${id}/fulfillment`))
          .set(auth(owner))
          .send({ status });
      const fulfillmentEvents = () =>
        (emitSpy.mock.calls as unknown[][]).filter(
          ([, type]) => type === 'order.fulfillment_changed',
        );

      await move('ready').expect(409);
      await move('pending').expect(400);

      emitSpy.mockClear();
      const preparing = await move('preparing').expect(200);
      expect(preparing.body.order.fulfillmentStatus).toBe('preparing');
      expect(fulfillmentEvents()).toEqual([
        [
          seed.branchA.id,
          'order.fulfillment_changed',
          expect.objectContaining({
            orderCode: 'PED-0001',
            orderType: 'delivery',
            fulfillmentStatus: 'preparing',
            phone: `+${PHONE}`,
          }),
        ],
      ]);

      emitSpy.mockClear();
      for (let i = 0; i < 2; i++) {
        const res = await http()
          .patch(`${ORDERS_URL}/PED-0001`)
          .set(bot())
          .send({ fulfillmentStatus: 'on_the_way' })
          .expect(200);
        expect(res.body.order.fulfillmentStatus).toBe('on_the_way');
      }
      expect(fulfillmentEvents()).toHaveLength(0);

      await move('delivered').expect(200);
      const toDeliver = await http()
        .get(panelUrl(`to-deliver?branchId=${seed.branchA.id}`))
        .set(auth(owner))
        .expect(200);
      expect(toDeliver.body.total).toBe(0);
      expect((await orderOf('PED-0001')).fulfillmentUpdatedAt).not.toBeNull();
    });

    it('lets the bot cancel an unpaid pickup and returns the wallet', async () => {
      await openOrder({
        code: 'PED-0002',
        type: 'pickup',
        phone: PHONE,
        items: items(),
      }).expect(201);
      await giveWallet(15);

      await http()
        .patch(`${ORDERS_URL}/PED-0002`)
        .set(bot())
        .send({ fulfillmentStatus: 'ready' })
        .expect(409);
      await http()
        .patch(`${ORDERS_URL}/PED-0002`)
        .set(bot())
        .send({ status: 'payment_link', fulfillmentStatus: 'ready' })
        .expect(400);
      await http()
        .patch(`${ORDERS_URL}/PED-0002`)
        .set(bot())
        .send({})
        .expect(400);

      const link = await http()
        .patch(`${ORDERS_URL}/PED-0002`)
        .set(bot())
        .send({ status: 'payment_link', walletUse: 'all' })
        .expect(200);
      expect(link.body.order.walletDiscount).toBe(15);

      const cancelled = await http()
        .patch(`${ORDERS_URL}/PED-0002`)
        .set(bot())
        .send({ status: 'cancelled' })
        .expect(200);
      expect(cancelled.body.order.status).toBe('cancelled');
      expect(cancelled.body.walletBalance).toBe(15);
      expect((await orderOf('PED-0002')).closedAt).not.toBeNull();
    });

    it('does not let the bot cancel a table account', async () => {
      const { validTables } = await dataSource
        .getRepository(Branch)
        .findOneByOrFail({ id: seed.branchA.id });
      await openOrder({
        code: 'MESA-0001',
        phone: PHONE,
        table: validTables[0] ?? '1',
        items: items(),
      }).expect(201);
      await http()
        .patch(`${ORDERS_URL}/MESA-0001`)
        .set(bot())
        .send({ status: 'cancelled' })
        .expect(409);
      await http()
        .patch(`${ORDERS_URL}/MESA-0001`)
        .set(bot())
        .send({ fulfillmentStatus: 'preparing' })
        .expect(409);
    });

    it('leaves unpaid orders out of the daily close', async () => {
      await openOrder({
        code: 'PED-0003',
        type: 'pickup',
        phone: PHONE,
        items: items(),
      }).expect(201);

      const res = await http()
        .post('/v1/bot/daily-close')
        .set(bot())
        .expect(200);
      expect(res.body.closed).toContain('MESA-0001');
      expect(res.body.closed).not.toContain('PED-0003');
      expect((await orderOf('PED-0003')).status).toBe(OrderStatus.OPEN);
    });

    it('counts pickup and delivery orders in the day only once they are paid', async () => {
      const owner = await tokenFor(seed.clientA.email);
      const summary = async () =>
        (
          await http()
            .get(`/v1/orders/summary?branchId=${seed.branchA.id}`)
            .set(auth(owner))
            .expect(200)
        ).body as { accounts: number; openAccounts: number };

      const before = await summary();
      await openOrder({
        code: 'PED-0005',
        type: 'pickup',
        phone: PHONE,
        items: items(),
      }).expect(201);
      // Sin pagar no es una cuenta del día ni una mesa abierta.
      expect(await summary()).toMatchObject(before);

      const link = await http()
        .patch(`${ORDERS_URL}/PED-0005`)
        .set(bot())
        .send({ status: 'payment_link' })
        .expect(200);
      await http()
        .post('/v1/bot/payments')
        .set(bot())
        .send({
          orderCode: 'PED-0005',
          providerPaymentId: 'MP-PED-0005',
          amount: (link.body.order as OrderBody).amountDue,
        })
        .expect(201);

      const paid = await summary();
      expect(paid.accounts).toBe(before.accounts + 1);
      expect(paid.openAccounts).toBe(before.openAccounts);
    });

    it('erases delivery addresses 30 days after the last change', async () => {
      await openOrder({
        code: 'PED-0004',
        type: 'delivery',
        phone: PHONE,
        delivery,
        items: items(),
      }).expect(201);

      const old = new Date(Date.now() - 31 * 24 * 60 * 60_000);
      await dataSource
        .getRepository(Order)
        .update(
          { code: 'PED-0001' },
          { openedAt: old, closedAt: old, fulfillmentUpdatedAt: old },
        );

      const purged = await app.get(OrderingPrivacyService).purgeDeliveryData();
      expect(purged).toBe(1);

      const erased = await orderOf('PED-0001');
      expect(erased).toMatchObject({
        deliveryAddress: null,
        deliveryReferences: null,
        deliveryLatitude: null,
        deliveryLongitude: null,
      });
      expect(Number(erased.deliveryFee)).toBe(42);
      expect((await orderOf('PED-0004')).deliveryAddress).toBe(
        delivery.address,
      );
    });
  });
  describe('cancelling paid orders', () => {
    const PHONE = '5215533330002';
    let botKey: string;
    let emitSpy: jest.SpyInstance;

    const bot = () => ({ 'X-BotBite-Key': botKey });
    const orderOf = (code: string) =>
      dataSource.getRepository(Order).findOneByOrFail({ code });
    const membership = async () => {
      const customer = await dataSource
        .getRepository(Customer)
        .findOneByOrFail({ phone: `+${PHONE}` });
      return dataSource.getRepository(RestaurantCustomer).findOneByOrFail({
        customerId: customer.id,
        restaurantId: seed.restaurantA.id,
      });
    };
    const balance = async () => Number((await membership()).walletBalance);
    const setBalance = async (walletBalance: number) => {
      const { id } = await membership();
      await dataSource
        .getRepository(RestaurantCustomer)
        .update({ id }, { walletBalance });
    };
    const cancelPaid = (id: string, token: string) =>
      http().post(`/v1/orders/${id}/cancel-paid`).set(auth(token)).send();

    /** Pedido para recoger pagado, usando `wallet` de saldo. */
    const paidPickup = async (code: string, wallet: number) => {
      await http()
        .post('/v1/bot/orders')
        .set(bot())
        .send({
          code,
          type: 'pickup',
          phone: PHONE,
          customerName: 'Luis',
          items: [{ menuItemId: seed.menuItem.id, quantity: 3 }],
        })
        .expect(201);
      await setBalance(wallet);
      const link = await http()
        .patch(`/v1/bot/orders/${code}`)
        .set(bot())
        .send({ status: 'payment_link', walletUse: 'all' })
        .expect(200);
      const amountDue = (link.body.order as { amountDue: number }).amountDue;
      const paid = await http()
        .post('/v1/bot/payments')
        .set(bot())
        .send({
          orderCode: code,
          providerPaymentId: `MP-${code}`,
          amount: amountDue,
        })
        .expect(201);
      return {
        order: await orderOf(code),
        amountDue,
        cashback: paid.body.cashback as number,
      };
    };

    beforeAll(async () => {
      const admin = await tokenFor(seed.superUser.email);
      const created = await http()
        .post(`/v1/branches/${seed.restaurantA.id}/${seed.branchA.id}/bot-keys`)
        .set(auth(admin))
        .send({ name: 'cancelaciones' })
        .expect(201);
      botKey = created.body.secret as string;
      emitSpy = jest.spyOn(app.get(BotEventsService), 'emit');
    });

    afterAll(() => emitSpy.mockRestore());

    it('returns the wallet, takes back the cashback and tells the cashier and the bot', async () => {
      const { order, amountDue, cashback } = await paidPickup('CAN-0001', 10);
      expect(cashback).toBeGreaterThan(0);
      // Le quedó el cashback; lo usado ya se descontó.
      expect(await balance()).toBeCloseTo(cashback, 2);

      emitSpy.mockClear();
      const owner = await tokenFor(seed.clientA.email);
      const res = await cancelPaid(order.id, owner).expect(200);

      expect(res.body).toMatchObject({
        order: {
          status: 'cancelled',
          fulfillmentStatus: 'cancelled',
          walletDiscount: 10,
        },
        refundAmount: amountDue,
        providerPaymentId: 'MP-CAN-0001',
      });
      // Vuelven los 10 usados y se va el cashback.
      expect(await balance()).toBeCloseTo(10, 2);

      const alert = await dataSource
        .getRepository(CashierNotification)
        .findOneByOrFail({ orderId: order.id, type: NotificationType.ALERT });
      expect(alert.message).toContain(
        'Se canceló el pedido para recoger de Luis',
      );
      expect(alert.message).toContain(`Reembolsa $${amountDue.toFixed(2)}`);

      const cancelled = (emitSpy.mock.calls as unknown[][]).filter(
        ([, type]) => type === 'order.cancelled',
      );
      expect(cancelled).toEqual([
        [
          seed.branchA.id,
          'order.cancelled',
          expect.objectContaining({
            orderCode: 'CAN-0001',
            orderType: 'pickup',
            refundAmount: amountDue,
            providerPaymentId: 'MP-CAN-0001',
            phone: `+${PHONE}`,
          }),
        ],
      ]);

      await cancelPaid(order.id, owner).expect(409);

      // En Cobros sigue el pago, marcado para reembolsar y con su tipo.
      const billing = await http()
        .get(`/v1/orders/billing?branchId=${seed.branchA.id}`)
        .set(auth(owner))
        .expect(200);
      const payments = billing.body.payments as {
        providerPaymentId: string;
        status: string;
        orderType: string | null;
        toRefund: boolean;
      }[];
      expect(
        payments.find((p) => p.providerPaymentId === 'MP-CAN-0001'),
      ).toMatchObject({
        status: 'approved',
        orderType: 'pickup',
        toRefund: true,
      });
      expect(
        payments.filter((p) => p.toRefund).map((p) => p.providerPaymentId),
      ).toEqual(['MP-CAN-0001']);
      expect(
        payments.find((p) => p.providerPaymentId === 'MP-PED-0001'),
      ).toMatchObject({
        orderType: 'delivery',
        toRefund: false,
      });

      const toDeliver = await http()
        .get(`/v1/orders/to-deliver?branchId=${seed.branchA.id}`)
        .set(auth(owner))
        .expect(200);
      expect(
        toDeliver.body.orders.map((o: { code: string }) => o.code),
      ).not.toContain('CAN-0001');
    });

    it('never leaves the wallet below zero', async () => {
      const { order, cashback } = await paidPickup('CAN-0002', 0);
      // Ya se gastó el cashback.
      await setBalance(cashback / 2);

      const admin = await tokenFor(seed.superUser.email);
      await cancelPaid(order.id, admin).expect(200);
      expect(await balance()).toBe(0);
    });

    it('only cancels paid orders that were not delivered, for their owner', async () => {
      const { order } = await paidPickup('CAN-0003', 0);
      const otherOwner = await tokenFor(seed.clientB.email);
      await cancelPaid(order.id, otherOwner).expect(403);

      const owner = await tokenFor(seed.clientA.email);
      await http()
        .patch(`/v1/orders/${order.id}/fulfillment`)
        .set(auth(owner))
        .send({ status: 'ready' })
        .expect(200);
      await http()
        .patch(`/v1/orders/${order.id}/fulfillment`)
        .set(auth(owner))
        .send({ status: 'delivered' })
        .expect(200);
      await cancelPaid(order.id, owner).expect(409);

      const unpaid = await http()
        .post('/v1/bot/orders')
        .set(bot())
        .send({
          code: 'CAN-0004',
          type: 'pickup',
          phone: PHONE,
          items: [{ menuItemId: seed.menuItem.id, quantity: 1 }],
        })
        .expect(201);
      await cancelPaid(unpaid.body.order.id as string, owner).expect(409);
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
    restaurants.create({
      name: 'Tacos A',
      slug: 'restaurante-a',
      userId: clientA.id,
    }),
    restaurants.create({
      name: 'Tacos B',
      slug: 'restaurante-b',
      userId: clientB.id,
    }),
  ]);

  const branches = dataSource.getRepository(Branch);
  const [branchA, branchB] = await branches.save([
    branches.create({
      name: 'Centro',
      slug: 'centro',
      // El Postgres embebido de las pruebas no trae todas las zonas horarias.
      timezone: 'America/Mexico_City',
      address: 'Calle 1',
      restaurantId: restaurantA.id,
      phoneNumberAssistant: ASSISTANT_PHONE,
      phoneNumberReception: RECEPTION_PHONE,
    }),
    branches.create({
      name: 'Norte',
      slug: 'norte',
      address: 'Calle 2',
      restaurantId: restaurantB.id,
    }),
  ]);

  const category = await dataSource
    .getRepository(Category)
    .save({ name: 'TACOS', restaurantId: restaurantA.id });
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

  const foreignCategory = await dataSource
    .getRepository(Category)
    .save({ name: 'AJENOS', restaurantId: restaurantB.id });
  const foreignProduct = await dataSource
    .getRepository(Product)
    .save(
      dataSource
        .getRepository(Product)
        .create({ name: 'Ajeno', restaurantId: restaurantB.id }),
    );
  const foreignMenu = await dataSource
    .getRepository(Menu)
    .save({ name: 'Principal', branchId: branchB.id });
  const foreignMenuItem = await dataSource.getRepository(MenuItem).save({
    menuId: foreignMenu.id,
    productId: foreignProduct.id,
    categoryId: foreignCategory.id,
    price: 99,
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
    category,
    menu,
    menuItem,
    foreignMenuItem,
    notification,
  };
}
