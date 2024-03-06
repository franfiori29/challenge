import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

export const CreateOrderSchema = z.object({
  estimateId: z.string().length(36),
});

export type CreateOrder = z.infer<typeof CreateOrderSchema>;

export class CreateOrderDto extends createZodDto(CreateOrderSchema) {}
