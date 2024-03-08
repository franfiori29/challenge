import { OrderType, Side } from '@binance/connector-typescript';
// import { exchangeInformationResponse } from '@binance/connector-typescript';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { priceExpiration } from '../config';
import { OptimalPrice } from '../dto/optimal.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class OrderBooksService {
  constructor(
    private readonly binanceService: BinanceService,
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getOptimalPrice(
    { symbol, side, volume }: OptimalPrice,
    userId: string,
  ) {
    const pair = await this.prismaService.pair.findUnique({
      where: {
        symbol,
      },
      include: {
        baseToken: true,
        quoteToken: true,
      },
    });

    if (!pair) {
      throw new NotFoundException();
    }

    const { asks, bids } = await this.binanceService.client.orderBook(
      pair.binanceProxySymbol ?? pair.symbol,
      { limit: 1000 },
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
    // price >= symbolsDictionary[symbol].notional
    if (subTotalPrice < pair.notional) {
      throw new BadRequestException('Notional value is too low');
    }

    const { totalPrice, fee, spread } = this.calculateFeeAndSpread({
      feePercentage: pair.feePercentage,
      side,
      spreadPercentage: pair.spreadPercentage,
      subTotalPrice,
    });

    const priceEstimation = await this.prismaService.priceEstimation.create({
      data: {
        side,
        expiration: new Date(Date.now() + priceExpiration),
        pairId: pair.id,
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
        pair: true,
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

    const userQuoteTokenBalance = await this.usersService.getUserBalance(
      estimation.pair.quoteTokenId,
      userId,
    );

    if (
      !userQuoteTokenBalance ||
      userQuoteTokenBalance.amount < estimation.price
    ) {
      throw new BadRequestException('Insufficient funds');
    }

    const order = await this.binanceService.client.newOrder(
      estimation.pair.binanceProxySymbol ?? estimation.pair.symbol,
      Side.BUY,
      OrderType.MARKET,
      {
        quantity: estimation.volume,
      },
    );

    await this.usersService.performBalanceTransaction(estimation, userId);

    const { fee, spread, totalPrice } = this.calculateFeeAndSpread({
      feePercentage: estimation.pair.feePercentage,
      side: estimation.side as Side,
      spreadPercentage: estimation.pair.spreadPercentage,
      subTotalPrice: +order.cummulativeQuoteQty!,
    });

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

  calculateFeeAndSpread({
    spreadPercentage,
    feePercentage,
    side,
    subTotalPrice,
  }: {
    spreadPercentage: number;
    feePercentage: number;
    side: Side;
    subTotalPrice: number;
  }) {
    const spread = +(subTotalPrice * spreadPercentage).toFixed(8);
    const fee = +(subTotalPrice * feePercentage).toFixed(8);
    const totalPrice =
      side === Side.BUY
        ? +(subTotalPrice + spread + fee).toFixed(8)
        : +(subTotalPrice - spread - fee).toFixed(8);
    return { totalPrice, spread, fee };
  }
}
