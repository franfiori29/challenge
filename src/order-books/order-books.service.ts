import { OrderType, Side } from '@binance/connector-typescript';
// import { exchangeInformationResponse } from '@binance/connector-typescript';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { priceExpiration, symbolsDictionary } from '../config';
import { OptimalPrice } from '../dto/optimal.dto';
import { SymbolsService } from '../symbols/symbols.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderBooksService {
  constructor(
    private readonly symbolsService: SymbolsService,
    private readonly binanceService: BinanceService,
    private readonly prismaService: PrismaService,
  ) {}

  async getOptimalPrice(
    { symbol, side, volume }: OptimalPrice,
    userId: string,
  ) {
    const { asks, bids } = await this.binanceService.client.orderBook(
      this.symbolsService.getSymbolForBinance(symbol),
      { limit: 500 },
    );

    const subTotalPrice = this.getOptimalPriceFromOrders(
      side === Side.BUY ? asks : bids,
      volume,
    );

    if (!subTotalPrice) {
      throw new NotFoundException(
        'Requested volume cannot be covered by available orders',
      );
    }

    if (!this.symbolsService.isNotionalValid(symbol, subTotalPrice)) {
      throw new BadRequestException('Notional value is too low');
    }

    const { totalPrice, fee, spread } = this.calculateFeeAndSpread(
      symbol,
      subTotalPrice,
      side,
    );

    const priceEstimation = await this.prismaService.priceEstimation.create({
      data: {
        side,
        expiration: new Date(Date.now() + priceExpiration),
        pair: symbol,
        subtotal: subTotalPrice,
        spread,
        fee,
        price: totalPrice,
        volume,
        userId,
      },
    });

    return {
      price: totalPrice,
      estimateId: priceEstimation.id,
      expires: priceEstimation.expiration,
    };
  }

  async createOrder(estimateId: string, userId: string) {
    const estimation = await this.prismaService.priceEstimation.findUnique({
      where: {
        id: estimateId,
        userId,
      },
      include: {
        swap: true,
      },
    });

    if (!estimation) {
      throw new NotFoundException();
    }
    if (estimation.swap) {
      throw new ConflictException();
    }
    if (estimation.expiration < new Date()) {
      throw new BadRequestException();
    }

    const order = await this.binanceService.client.newOrder(
      estimation.pair,
      Side.BUY,
      OrderType.MARKET,
      {
        quantity: estimation.volume,
      },
    );

    const { fee, spread, totalPrice } = this.calculateFeeAndSpread(
      estimation.pair,
      +order.cummulativeQuoteQty!,
      estimation.side as Side,
    );

    const swap = await this.prismaService.swap.create({
      data: {
        priceEstimationId: estimation.id,
        orderId: order.orderId.toString(),
        fee,
        spread,
        subtotal: +order.cummulativeQuoteQty!,
        total: totalPrice,
        userId,
      },
      select: {
        id: true,
        total: true,
      },
    });

    return swap;
  }

  getOptimalPriceFromOrders(orders: string[][], volume: number) {
    let totalVolume = 0;
    let totalPrice = 0;
    for (const order of orders) {
      const price = +order[0];
      const orderVolume = +order[1];
      if (totalVolume + orderVolume >= volume) {
        const remainingVolume = volume - totalVolume;
        totalPrice += price * remainingVolume;
        totalVolume = volume;
        break;
      } else {
        totalPrice += price * orderVolume;
        totalVolume += orderVolume;
      }
    }

    return totalVolume < volume ? null : +totalPrice.toFixed(8);
  }

  calculateFeeAndSpread(
    symbol: keyof typeof symbolsDictionary,
    subTotalPrice: number,
    side: Side,
  ) {
    const { spreadPercentage, feePercentage } = symbolsDictionary[symbol];
    const spread = +(subTotalPrice * spreadPercentage).toFixed(8);
    const fee = +(subTotalPrice * feePercentage).toFixed(8);
    const totalPrice =
      side === Side.BUY
        ? +(subTotalPrice + spread + fee).toFixed(8)
        : +(subTotalPrice - spread - fee).toFixed(8);
    return { totalPrice, spread, fee };
  }
}
