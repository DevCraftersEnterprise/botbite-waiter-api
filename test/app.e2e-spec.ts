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
  category: Category;
  menu: Menu;
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
      expect(Object.keys(paths)).toEqual(['/v1/bot/branch']);
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
    notification,
  };
}
