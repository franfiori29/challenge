import { Injectable } from '@nestjs/common';

import { Spot } from '@binance/connector-typescript';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BinanceService {
  public readonly client: Spot;

  constructor(private configService: ConfigService) {
    const binanceClient = new Spot(
      this.configService.get('BINANCE_API_KEY'),
      this.configService.get('BINANCE_API_SECRET'),
      {
        baseURL: 'https://testnet.binance.vision',
      },
    );
    this.client = binanceClient;
  }
}
