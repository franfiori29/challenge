import { PrismaClient, Token } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

const tokensToInsert = [
  {
    name: 'BTC',
  },
  {
    name: 'ETH',
  },
  {
    name: 'USDT',
  },
  {
    name: 'AAVE',
  },
  {
    name: 'USDC',
  },
];

async function main() {
  const tokens: Token[] = [];
  for await (const token of tokensToInsert) {
    const tokenCreated = await prisma.token.create({
      data: token,
    });
    tokens.push(tokenCreated);
  }

  await prisma.pair.createMany({
    data: [
      //BTCUSDT
      {
        baseTokenId: tokens.find((token) => token.name === 'BTC')!.id,
        quoteTokenId: tokens.find((token) => token.name === 'USDT')!.id,
        symbol: 'BTCUSDT',
        notional: 5,
        feePercentage: 0.001,
        spreadPercentage: 0.01,
      },
      //ETHUSDT
      {
        baseTokenId: tokens.find((token) => token.name === 'ETH')!.id,
        quoteTokenId: tokens.find((token) => token.name === 'USDT')!.id,
        symbol: 'ETHUSDT',
        notional: 5,
        feePercentage: 0.001,
        spreadPercentage: 0.01,
      },
      //AAVEUSDC
      {
        baseTokenId: tokens.find((token) => token.name === 'AAVE')!.id,
        quoteTokenId: tokens.find((token) => token.name === 'USDT')!.id,
        symbol: 'AAVEUSDC',
        binanceProxySymbol: 'AAVEUSDT',
        notional: 5,
        feePercentage: 0.001,
        spreadPercentage: 0.01,
      },
    ],
  });

  await prisma.user.create({
    data: {
      password: bcrypt.hashSync('password', 10),
      username: 'user',
      balances: {
        createMany: {
          data: tokens.map((token) => ({ tokenId: token.id, amount: 100 })),
        },
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
