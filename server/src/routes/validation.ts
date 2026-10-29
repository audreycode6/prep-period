import { z } from 'zod';

export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
