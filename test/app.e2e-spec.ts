import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { Side } from '@binance/connector-typescript';
import { OrderBooksService } from '../src/order-books/order-books.service';
import { SymbolsService } from '../src/symbols/symbols.service';
import { BinanceService } from '../src/binance/binance.service';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

describe('AppController', () => {
  // let appController: AppController;
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      controllers: [AppController],
      providers: [
        AppService,
        OrderBooksService,
        SymbolsService,
        BinanceService,
        PrismaService,
        {
          provide: APP_PIPE,
          useClass: ZodValidationPipe,
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    prismaService = moduleRef.get<PrismaService>(PrismaService);
    await app.init();
    // appController = moduleRef.get<AppController>(AppController);
  });

  describe('optimal endpoint', () => {
    it('should return a valid price, expire time and estimateId', async () => {
      const res = await request(app.getHttpServer())
        .get('/optimal')
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
      const buyResponse = request(app.getHttpServer()).get('/optimal').query({
        symbol: 'BTCUSDT',
        side: Side.BUY,
        volume: 0.0001,
      });
      const sellRespones = request(app.getHttpServer()).get('/optimal').query({
        symbol: 'BTCUSDT',
        side: Side.SELL,
        volume: 0.0001,
      });
      const [buy, sell] = await Promise.all([buyResponse, sellRespones]);
      expect(buy.body.price).toBeGreaterThan(sell.body.price);
    });

    it('should not accept other symbols', async () => {
      return request(app.getHttpServer())
        .get('/optimal')
        .query({
          symbol: 'DOGEUSDT',
          side: Side.BUY,
          volume: 0.0001,
        })
        .expect(400);
    });

    it('should not accept a wrong side', async () => {
      return request(app.getHttpServer())
        .get('/optimal')
        .query({
          symbol: 'BTCUSDT',
          side: 'LOAN',
          volume: 0.0001,
        })
        .expect(400);
    });

    it('should error if the asked volume is too high', async () => {
      return request(app.getHttpServer())
        .get('/optimal')
        .query({
          symbol: 'BTCUSDT',
          side: Side.BUY,
          volume: 100000000,
        })
        .expect(404);
    });

    it('should error if the asked volume is for a lower price than the notional', async () => {
      return request(app.getHttpServer())
        .get('/optimal')
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
      const estimate = await request(app.getHttpServer())
        .get('/optimal')
        .query({
          symbol: 'BTCUSDT',
          side: Side.BUY,
          volume: 0.0001,
        });

      const res = await request(app.getHttpServer())
        .post('/order')
        .send({
          estimateId: estimate.body.estimateId,
        })
        .expect(201);

      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('id');
    });

    it('should not accept a not existing estimate', async () => {
      return request(app.getHttpServer())
        .post('/order')
        .send({
          estimateId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        })
        .expect(404);
    });

    it('should not continue for an expired estimated price', async () => {
      jest
        .spyOn(prismaService.priceEstimation, 'findUnique')
        //@ts-expect-error mock implementation
        .mockImplementationOnce(async () => {
          return {
            expiration: new Date('2021-01-01'),
          };
        });
      const a = await request(app.getHttpServer())
        .post('/order')
        .send({
          estimateId: 'aaaaaaaa-bbbb-bbbb-bbbb-aaaaaaaaaaaa',
        })
        .expect(400);
      return a;
    });

    it('should not continue for a used estimated price', async () => {
      jest
        .spyOn(prismaService.priceEstimation, 'findUnique')
        //@ts-expect-error mock implementation
        .mockImplementationOnce(async () => {
          return {
            expiration: new Date(Date.now() + 60 * 1000),
            swap: {
              id: 'asd',
            },
          };
        });
      const a = await request(app.getHttpServer())
        .post('/order')
        .send({
          estimateId: 'aaaaaaaa-bbbb-bbbb-bbbb-aaaaaaaaaaaa',
        })
        .expect(409);
      return a;
    });
  });
});
