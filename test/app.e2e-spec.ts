import { Test, TestingModule } from '@nestjs/testing';
import { Side } from '@binance/connector-typescript';
import { PrismaService } from '../src/prisma/prisma.service';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { OrderBooksService } from '../src/order-books/order-books.service';
import { BinanceService } from '../src/binance/binance.service';
import { JwtService } from '@nestjs/jwt';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { AuthGuard } from '../src/auth/auth.guard';

describe('AppController', () => {
  // let appController: AppController;
  let app: INestApplication;
  let prismaService: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        AuthModule,
        UsersModule,
      ],
      controllers: [AppController],
      providers: [
        AppService,
        OrderBooksService,
        BinanceService,
        PrismaService,
        JwtService,
        {
          provide: APP_PIPE,
          useClass: ZodValidationPipe,
        },
        {
          provide: APP_GUARD,
          useClass: AuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    prismaService = moduleRef.get<PrismaService>(PrismaService);
    await app.init();

    const res = await request(app.getHttpServer()).post('/auth/login').send({
      username: 'user',
      password: 'password',
    });
    token = res.body.access_token;

    await prismaService.balance.updateMany({
      data: {
        amount: 100,
      },
      where: {
        user: {
          username: 'user',
        },
      },
    });
  });

  function makeRequest(type: 'get' | 'post', path: string) {
    return request(app.getHttpServer())
      [type](path)
      .set('Authorization', `Bearer ${token}`);
  }

  describe('optimal endpoint', () => {
    it('should return a valid price, expire time and estimateId', async () => {
      const res = await makeRequest('get', '/optimal')
        // .get('/optimal')
        .query({
          symbol: 'BTCUSDT',
          side: Side.BUY,
          volume: 0.0001,
        })
        .expect(200);
      expect(res.body).toHaveProperty('price');
      expect(typeof res.body.price).toBe('number');
      expect(res.body).toHaveProperty('expires');
      expect(typeof new Date(res.body.expires).getTime()).toBe('number');
      expect(res.body).toHaveProperty('estimateId');
    });

    it('should return a higher buy value than a sell value', async () => {
      const buyResponse = makeRequest('get', '/optimal').query({
        symbol: 'BTCUSDT',
        side: Side.BUY,
        volume: 0.0001,
      });
      const sellRespones = makeRequest('get', '/optimal').query({
        symbol: 'BTCUSDT',
        side: Side.SELL,
        volume: 0.0001,
      });
      const [buy, sell] = await Promise.all([buyResponse, sellRespones]);
      expect(buy.body.price).toBeGreaterThan(sell.body.price);
    });

    it('should not accept other symbols', async () => {
      return makeRequest('get', '/optimal')
        .query({
          symbol: 'DOGEUSDT',
          side: Side.BUY,
          volume: 0.0001,
        })
        .expect(404);
    });

    it('should not accept a wrong side', async () => {
      return makeRequest('get', '/optimal')
        .query({
          symbol: 'BTCUSDT',
          side: 'LOAN',
          volume: 0.0001,
        })
        .expect(400);
    });

    it('should error if the asked volume is too high', async () => {
      return makeRequest('get', '/optimal')
        .query({
          symbol: 'BTCUSDT',
          side: Side.BUY,
          volume: 100000000,
        })
        .expect(404);
    });

    it('should error if the asked volume is for a lower price than the notional', async () => {
      return makeRequest('get', '/optimal')
        .query({
          symbol: 'BTCUSDT',
          side: Side.BUY,
          volume: 0.000001,
        })
        .expect(400);
    });
  });

  describe('order endpoint', () => {
    it('should return a valid swap', async () => {
      const estimate = await makeRequest('get', '/optimal').query({
        symbol: 'BTCUSDT',
        side: Side.BUY,
        volume: 0.0001,
      });

      const res = await makeRequest('post', '/order')
        .send({
          estimateId: estimate.body.estimateId,
        })
        .expect(201);

      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('id');
    });

    it('should not accept a not existing estimate', async () => {
      return makeRequest('post', '/order')
        .send({
          estimateId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        })
        .expect(404);
    });

    it('should not continue for an expired estimated price', async () => {
      const est = await prismaService.priceEstimation.create({
        data: expiredEstimateobject,
      });

      const a = await makeRequest('post', '/order')
        .send({
          estimateId: est.id,
        })
        .expect(400);
      return a;
    });

    it('should not continue for a used estimated price', async () => {
      const est = await prismaService.priceEstimation.create({
        data: usedEstimateobject,
      });

      const a = await makeRequest('post', '/order')
        .send({
          estimateId: est.id,
        })
        .expect(409);
      return a;
    });

    it("should error if no funds on the user's balance", async () => {
      const estimate = await makeRequest('get', '/optimal').query({
        symbol: 'BTCUSDT',
        side: Side.BUY,
        volume: 0.1,
      });

      const res = await makeRequest('post', '/order')
        .send({
          estimateId: estimate.body.estimateId,
        })
        .expect(400);

      expect(res.body.message).toBe('Insufficient funds');
    });
  });
});

const expiredEstimateobject = {
  expiration: new Date('2021-03-03'),
  fee: 0.1,
  price: 0.1,
  side: 'BUY',
  spread: 0.1,
  subtotal: 0.1,
  volume: 0.1,
  user: {
    connect: {
      username: 'user',
    },
  },
  pair: {
    connect: {
      symbol: 'BTCUSDT',
    },
  },
} as const;

const usedEstimateobject = {
  expiration: new Date('2024-03-03'),
  fee: 0.1,
  price: 0.1,
  side: 'BUY',
  spread: 0.1,
  subtotal: 0.1,
  volume: 0.1,
  user: {
    connect: {
      username: 'user',
    },
  },
  pair: {
    connect: {
      symbol: 'BTCUSDT',
    },
  },
  swap: {
    create: {
      fee: 0.1,
      orderId: '123',
      spread: 0.1,
      subtotal: 0.1,
      total: 0.1,
      user: {
        connect: {
          username: 'user',
        },
      },
    },
  },
} as const;
