import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  activitiesReplaceSchema,
  type Activity,
  type ApiErrorBody,
} from '@prep-period/shared';
import { replaceActivities } from '../db/plans.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { isUuid } from './validation.js';

export const blocksRouter = Router();
blocksRouter.use(requireAuth);

type IdParams = { id: string };

/**
 * Takes a validation error and returns its messages grouped by path,
 * e.g. '1.label', so each message points at the item and property it's about.
 */
function fieldErrorsByPath(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (fields[key] === undefined) {
      fields[key] = [];
    }
    fields[key].push(issue.message);
  }
  return fields;
}

blocksRouter.put(
  '/:id/activities',
  async (
    req: Request<IdParams, Activity[] | ApiErrorBody, unknown>,
    res: Response<Activity[] | ApiErrorBody>,
  ) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'block not found' });
      return;
    }
    const result = activitiesReplaceSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'invalid activities',
        fields: fieldErrorsByPath(result.error),
      });
      return;
    }

    const activities = await replaceActivities(
      req.teacherId!,
      req.params.id,
      result.data,
    );
    if (activities === undefined) {
      res.status(404).json({ error: 'block not found' });
      return;
    }
    if (activities === 'invalid_activity_ids') {
      res
        .status(400)
        .json({ error: "activity ids don't match this block's activities" });
      return;
    }
    res.json(activities);
  },
);
