import { Injectable } from '@nestjs/common';
import { symbolsDictionary } from '../config';

@Injectable()
export class SymbolsService {
  getSymbolForBinance(symbol: keyof typeof symbolsDictionary) {
    return symbolsDictionary[symbol].binanceProxy ?? symbol;
  }

  getSymbolFeeAndSpread(symbol: keyof typeof symbolsDictionary) {
    const { spreadPercentage, feePercentage } = symbolsDictionary[symbol];
    return { spreadPercentage, feePercentage };
  }

  isNotionalValid(symbol: keyof typeof symbolsDictionary, price: number) {
    return price >= symbolsDictionary[symbol].notional;
  }
}
