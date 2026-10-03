import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { UserRoles } from '@/core/auth/enums/user-roles.enum';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Category } from '@/modules/categories/entities/category.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { TwilioService } from '@/modules/messages/services/twilio.service';
import { Order } from '@/modules/orders/entities/order.entity';
import { Product } from '@/modules/products/entities/product.entity';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { User } from '@/modules/users/entities/user.entity';

const PASSWORD = 'Sup3r-secret!';
const WEBHOOK_PATH = '/v1/messages/webhook';
const ASSISTANT_PHONE = '+5215511110001';
const RECEPTION_PHONE = '+5215511110002';
const CUSTOMER_PHONE = '+5215522220001';
const QR_TOKEN = 'QR-1700000000000-0123456789abcdef0123456789abcdef';

interface Seed {
  superUser: User;
  clientA: User;
  clientB: User;
  restaurantA: Restaurant;
  branchA: Branch;
  restaurantB: Restaurant;
  branchB: Branch;
}

describe('BotBite API (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let seed: Seed;
  let sendSpy: jest.SpyInstance;
  let baseUrl: string;
  let sidCounter = 0;

  const http = () => request(app.getHttpServer());

  const login = async (email: string) => {
    const res = await http()
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
    return res.body as { access_token: string; refresh_token: string };
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Envía un webhook firmado como lo haría Twilio. */
  const sendWhatsapp = (body: string, from = CUSTOMER_PHONE, sid?: string) => {
    const params = {
      MessageSid: sid ?? `SM${++sidCounter}`,
      AccountSid: process.env.TWILIO_ACCOUNT_SID!,
      From: `whatsapp:${from}`,
      To: `whatsapp:${ASSISTANT_PHONE}`,
      Body: body,
      ProfileName: 'Ana',
      NumMedia: '0',
      // Campo extra que Twilio siempre envía y la API no usa.
      SmsStatus: 'received',
    };
    const signature = getExpectedTwilioSignature(
      process.env.TWILIO_AUTH_TOKEN!,
      `${process.env.TWILIO_WEBHOOK_BASE_URL}${WEBHOOK_PATH}`,
      params,
    );
    return http()
      .post(WEBHOOK_PATH)
      .set('X-Twilio-Signature', signature)
      .type('form')
      .send(params);
  };

  /** Espera a que el bot (asíncrono) envíe `count` mensajes nuevos. */
  const waitForReplies = async (count: number) => {
    const target = sendSpy.mock.calls.length + count;
    const start = Date.now();
    while (sendSpy.mock.calls.length < target) {
      if (Date.now() - start > 10_000) {
        throw new Error(`Timed out waiting for ${count} replies`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return sendSpy.mock.calls.slice(-count) as [string, string, string][];
  };

  const lastReplyTo = (phone: string) =>
    [...(sendSpy.mock.calls as [string, string][])]
      .reverse()
      .find(([to]) => to === phone)?.[1] ?? '';

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

    sendSpy = jest
      .spyOn(app.get(TwilioService), 'sendWhatsAppMessage')
      .mockResolvedValue({ sid: 'SMout' } as never);

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

    it('a client cannot give itself message credits; an admin can', async () => {
      const client = await login(seed.clientA.email);
      const url = `/v1/branches/restaurant/${seed.restaurantA.id}/${seed.branchA.id}`;

      await http()
        .patch(url)
        .set(auth(client.access_token))
        .send({ availableMessages: 1000 })
        .expect(403);

      const admin = await login(seed.superUser.email);
      const res = await http()
        .patch(url)
        .set(auth(admin.access_token))
        .send({ availableMessages: 5 })
        .expect(200);

      expect(res.body.branch.availableMessages).toBe(105);
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
        .get(`/v1/messages/notifications?branchId=${seed.branchA.id}`)
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

  describe('WhatsApp webhook', () => {
    it('rejects unsigned requests', async () => {
      await http()
        .post(WEBHOOK_PATH)
        .type('form')
        .send({
          MessageSid: 'SMx',
          AccountSid: 'AC',
          From: 'x',
          To: 'y',
          Body: 'hola',
        })
        .expect(403);
    });

    it('serves a full order: QR → language → table → order → confirm → bill', async () => {
      const creditsBefore = await branchCredits(dataSource, seed.branchA.id);

      await sendWhatsapp('hola').expect(200);
      expect((await waitForReplies(1))[0][1]).toContain('QR');

      await sendWhatsapp(`🛡️ INICIO ${QR_TOKEN}`).expect(200);
      expect((await waitForReplies(1))[0][1]).toContain('Español');

      await sendWhatsapp('Español').expect(200);
      await waitForReplies(1);

      await sendWhatsapp('mesa 5').expect(200);
      await waitForReplies(1);

      await sendWhatsapp('quiero 2 tacos al pastor').expect(200);
      await waitForReplies(1);
      expect(lastReplyTo(CUSTOMER_PHONE)).toMatch(/TACO/i);

      await sendWhatsapp('si').expect(200);
      // Respuesta al cliente + aviso a caja.
      await waitForReplies(2);
      expect(lastReplyTo(RECEPTION_PHONE)).toContain('mesa 5');

      await sendWhatsapp('la cuenta por favor').expect(200);
      await waitForReplies(2);

      const orders = await dataSource.getRepository(Order).find({
        where: { branchId: seed.branchA.id },
        relations: { orderItems: true },
      });
      expect(orders).toHaveLength(1);
      expect(Number(orders[0].total)).toBe(50);
      expect(orders[0].orderItems).toHaveLength(2);

      // Se consumió un crédito por cada respuesta del flujo principal.
      expect(await branchCredits(dataSource, seed.branchA.id)).toBe(
        creditsBefore - 3,
      );
    });

    it('processes a retried webhook only once', async () => {
      const sid = 'SM-duplicate';
      await sendWhatsapp('hola', '+5215522229999', sid).expect(200);
      await waitForReplies(1);
      const calls = sendSpy.mock.calls.length;

      await sendWhatsapp('hola', '+5215522229999', sid).expect(200);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(sendSpy.mock.calls.length).toBe(calls);
    });

    it('ignores messages pretending to come from an unknown Twilio account', async () => {
      const params = {
        MessageSid: 'SM-foreign',
        AccountSid: 'AC11111111111111111111111111111111',
        From: `whatsapp:${CUSTOMER_PHONE}`,
        To: `whatsapp:${ASSISTANT_PHONE}`,
        Body: 'hola',
      };
      const signature = getExpectedTwilioSignature(
        process.env.TWILIO_AUTH_TOKEN!,
        `${process.env.TWILIO_WEBHOOK_BASE_URL}${WEBHOOK_PATH}`,
        params,
      );
      await http()
        .post(WEBHOOK_PATH)
        .set('X-Twilio-Signature', signature)
        .type('form')
        .send(params)
        .expect(403);
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
      const { access_token } = await login(seed.clientB.email);
      const socket = await connect(access_token);

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
  });
});

const branchCredits = async (dataSource: DataSource, branchId: string) =>
  (await dataSource.getRepository(Branch).findOneByOrFail({ id: branchId }))
    .availableMessages;

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
      availableMessages: 100,
      qrToken: QR_TOKEN,
    }),
    branches.create({
      name: 'Norte',
      address: 'Calle 2',
      restaurantId: restaurantB.id,
      availableMessages: 10,
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
  await dataSource.getRepository(MenuItem).save({
    menuId: menu.id,
    productId: product.id,
    categoryId: category.id,
    price: 25,
  });

  return {
    superUser,
    clientA,
    clientB,
    restaurantA,
    branchA,
    restaurantB,
    branchB,
  };
}
