import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';
import { Side } from '@binance/connector-typescript';

export const OptimalPriceSchema = z.object({
  symbol: z.string(),
  volume: z.coerce.number(),
  side: z.enum([Side.BUY, Side.SELL]),
});

export type OptimalPrice = z.infer<typeof OptimalPriceSchema>;

export class OptimalPriceDto extends createZodDto(OptimalPriceSchema) {}
