export const priceExpiration = 30 * 1000;

export const symbolsDictionary = {
  ETHUSDT: {
    feePercentage: 0.001,
    spreadPercentage: 0.01,
    notional: 5,
    binanceProxy: undefined,
  },
  BTCUSDT: {
    feePercentage: 0.001,
    spreadPercentage: 0.01,
    notional: 5,
    binanceProxy: undefined,
  },
  AAVEUSDC: {
    feePercentage: 0.002,
    spreadPercentage: 0.01,
    notional: 5,
    binanceProxy: 'AAVEUSDT',
  },
} as const;

export const symbolsArray = Object.keys(symbolsDictionary) as Array<
  keyof typeof symbolsDictionary
>;
