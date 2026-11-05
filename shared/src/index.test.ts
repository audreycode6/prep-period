import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  activityInputSchema,
  blockCreateSchema,
  blockUpdateSchema,
  planUpdateSchema,
} from './index.js';

/**
 * Parses `input` with `schema` and returns the message of
 * the first validation issue, or undefined when the input passes.
 */
function firstValidationMessage(
  schema: z.ZodType,
  input: unknown,
): string | undefined {
  return schema.safeParse(input).error?.issues[0]?.message;
}

describe('messages for input that stops a save', () => {
  it('rejects required text that is empty or only spaces as blank', () => {
    for (const label of ['', '   ']) {
      expect(firstValidationMessage(activityInputSchema, { label })).toBe(
        "Can't be blank",
      );
    }
  });

  it('rejects fractional activity minutes as not a whole number', () => {
    expect(
      firstValidationMessage(activityInputSchema, {
        label: 'Warm-up',
        minutes: 1.5,
      }),
    ).toBe('Minutes must be a whole number');
  });

  it('rejects zero or negative activity minutes as not above 0', () => {
    for (const minutes of [0, -5]) {
      expect(
        firstValidationMessage(activityInputSchema, {
          label: 'Warm-up',
          minutes,
        }),
      ).toBe('Minutes must be above 0');
    }
  });

  it('rejects a block time before 00:00 or after 23:59 as outside the day', () => {
    const block = { title: 'Math', startMinutes: 540, endMinutes: 600 };
    const message = 'Time must be between 00:00 and 23:59';
    expect(
      firstValidationMessage(blockCreateSchema, { ...block, startMinutes: -1 }),
    ).toBe(message);
    expect(
      firstValidationMessage(blockCreateSchema, { ...block, endMinutes: 1440 }),
    ).toBe(message);
  });

  it('rejects a block time that is not a whole number of minutes as not whole', () => {
    const block = { title: 'Math', startMinutes: 540, endMinutes: 600 };
    expect(
      firstValidationMessage(blockCreateSchema, {
        ...block,
        startMinutes: 540.5,
      }),
    ).toBe('Time must be a whole number of minutes');
  });
});

describe('today-note and block description', () => {
  it('turns empty or whitespace-only text into null', () => {
    for (const blank of ['', '   ']) {
      expect(planUpdateSchema.parse({ todayNote: blank }).todayNote).toBeNull();
      expect(
        blockUpdateSchema.parse({ description: blank }).description,
      ).toBeNull();
    }
  });

  it('keeps text that is not blank, trimmed', () => {
    expect(
      planUpdateSchema.parse({ todayNote: '  Fire drill at 10  ' }).todayNote,
    ).toBe('Fire drill at 10');
    expect(
      blockUpdateSchema.parse({ description: '  Bring the read-aloud book ' })
        .description,
    ).toBe('Bring the read-aloud book');
  });
});
