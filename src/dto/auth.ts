import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

export const RegisterSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(6).max(30),
});

export type Register = z.infer<typeof RegisterSchema>;

export class RegisterSchemaDto extends createZodDto(RegisterSchema) {}
