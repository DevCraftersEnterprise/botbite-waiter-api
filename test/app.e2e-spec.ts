import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { signBotEvent } from '@/modules/bot-events/bot-events.service';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Category } from '@/modules/categories/entities/category.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { CashierNotification } from '@/modules/notifications/entities/cashier-notifications.entity';
import { Order } from '@/modules/orders/entities/order.entity';
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

      expect((await create()).body.branch.slug).toBe('plaza-nandu');
      expect((await create()).body.branch.slug).toBe('plaza-nandu-2');
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

    it('rejects invalid values', async () => {
      const admin = await tokenFor(seed.superUser.email);

      for (const body of [
        { slug: 'Con Espacios' },
        { dailyCloseTime: '25:00' },
        { timezone: 'Marte/Olympus' },
        { botBaseUrl: 'http://sin-https.test' },
        { features: { desconocida: true } },
      ]) {
        await http().patch(configUrl()).set(auth(admin)).send(body).expect(400);
      }
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

      for (const status of ['paid', 'settled', 'cancelled', 'open']) {
        await setStatus(code, status).expect(400);
      }
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

    describe('events to n8n', () => {
      interface ReceivedEvent {
        type: string;
        branchId: string;
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
        // Hace de n8n: recibe los avisos y valida su firma.
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
              req.url !== '/webhook/mesero-centro/portal-evento' ||
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
            botBaseUrl: `http://127.0.0.1:${port}/webhook/mesero-centro`,
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
