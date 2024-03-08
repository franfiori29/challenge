import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(username: string) {
    return this.prisma.user.findUnique({
      where: {
        username,
      },
    });
  }

  async create(data: { username: string; password: string }) {
    return this.prisma.user.create({
      data,
    });
  }

  async getUserBalance(tokenId: string, userId: string) {
    return this.prisma.balance.findUnique({
      where: {
        userId_tokenId: {
          userId,
          tokenId,
        },
      },
    });
  }

  async performBalanceTransaction(
    estimation: PriceEstimationPayload,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.balance.update({
        where: {
          userId_tokenId: {
            tokenId: estimation.pair.quoteTokenId,
            userId,
          },
        },
        data: {
          amount: {
            [estimation.side === 'BUY' ? 'decrement' : 'increment']:
              estimation.price,
          },
        },
      });

      await tx.balance.update({
        where: {
          userId_tokenId: {
            tokenId: estimation.pair.baseTokenId,
            userId,
          },
        },
        data: {
          amount: {
            [estimation.side === 'BUY' ? 'increment' : 'decrement']:
              estimation.volume,
          },
        },
      });
    });
  }
}

type PriceEstimationPayload = Prisma.PriceEstimationGetPayload<{
  include: {
    swap: true;
    pair: true;
  };
}>;
