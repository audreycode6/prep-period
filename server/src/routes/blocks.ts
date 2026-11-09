import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  activitiesReplaceSchema,
  annotationsReplaceSchema,
  blockUpdateSchema,
  type Activity,
  type Annotation,
  type ApiErrorBody,
  type Block,
} from '@prep-period/shared';
import {
  deleteBlock,
  replaceActivities,
  replaceAnnotations,
  updateBlock,
} from '../db/blocks.js';
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

blocksRouter.patch(
  '/:id',
  async (
    req: Request<IdParams, Block | ApiErrorBody, unknown>,
    res: Response<Block | ApiErrorBody>,
  ) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'block not found' });
      return;
    }
    const result = blockUpdateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'invalid block',
        fields: z.flattenError(result.error).fieldErrors,
      });
      return;
    }
    const block = await updateBlock(req.teacherId!, req.params.id, result.data);
    if (block === undefined) {
      res.status(404).json({ error: 'block not found' });
      return;
    }
    if (block === 'invalid_times') {
      res.status(400).json({
        error: 'invalid block',
        fields: { endMinutes: ['End time must be after start time'] },
      });
      return;
    }
    res.json(block);
  },
);

blocksRouter.delete(
  '/:id',
  async (req: Request<IdParams>, res: Response<ApiErrorBody>) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'block not found' });
      return;
    }
    const deleted = await deleteBlock(req.teacherId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'block not found' });
      return;
    }
    res.status(204).end();
  },
);

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

blocksRouter.put(
  '/:id/annotations',
  async (
    req: Request<IdParams, Annotation[] | ApiErrorBody, unknown>,
    res: Response<Annotation[] | ApiErrorBody>,
  ) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'block not found' });
      return;
    }
    const result = annotationsReplaceSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'invalid annotations',
        fields: fieldErrorsByPath(result.error),
      });
      return;
    }

    const annotations = await replaceAnnotations(
      req.teacherId!,
      req.params.id,
      result.data,
    );
    if (annotations === undefined) {
      res.status(404).json({ error: 'block not found' });
      return;
    }
    if (annotations === 'invalid_activity_ids') {
      res
        .status(400)
        .json({ error: "an annotation's activity isn't in this block" });
      return;
    }
    res.json(annotations);
  },
);
