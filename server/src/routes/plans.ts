import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  blockCreateSchema,
  planCreateSchema,
  planUpdateSchema,
  type ApiErrorBody,
  type Block,
  type Plan,
  type PlanSummary,
} from '@prep-period/shared';
import {
  deletePlan,
  findPlan,
  insertBlock,
  insertPlan,
  listPlans,
  updatePlan,
} from '../db/plans.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { isUuid } from './validation.js';

export const plansRouter = Router();
plansRouter.use(requireAuth);

type IdParams = { id: string };
type PlanIdParams = { planId: string };

plansRouter.get('/', async (req: Request, res: Response<PlanSummary[]>) => {
  res.json(await listPlans(req.teacherId!));
});

plansRouter.post(
  '/',
  async (
    req: Request<Record<string, never>, Plan | ApiErrorBody, unknown>,
    res: Response<Plan | ApiErrorBody>,
  ) => {
    const result = planCreateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'invalid plan',
        fields: z.flattenError(result.error).fieldErrors,
      });
      return;
    }
    const plan = await insertPlan(req.teacherId!, result.data);
    if (plan === 'profile_not_found') {
      res.status(400).json({
        error: 'invalid plan',
        fields: { profileId: ['Profile not found'] },
      });
      return;
    }
    if (plan === 'profile_archived') {
      res.status(409).json({ error: 'profile is archived' });
      return;
    }
    if (plan === 'no_profile') {
      res.status(409).json({ error: 'create a profile first' });
      return;
    }
    res.status(201).json(plan);
  },
);

plansRouter.get(
  '/:id',
  async (req: Request<IdParams>, res: Response<Plan | ApiErrorBody>) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'plan not found' });
      return;
    }
    const plan = await findPlan(req.teacherId!, req.params.id);
    if (plan === undefined) {
      res.status(404).json({ error: 'plan not found' });
      return;
    }
    res.json(plan);
  },
);

plansRouter.patch(
  '/:id',
  async (
    req: Request<IdParams, Plan | ApiErrorBody, unknown>,
    res: Response<Plan | ApiErrorBody>,
  ) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'plan not found' });
      return;
    }
    const result = planUpdateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'invalid plan',
        fields: z.flattenError(result.error).fieldErrors,
      });
      return;
    }
    const plan = await updatePlan(req.teacherId!, req.params.id, result.data);
    if (plan === undefined) {
      res.status(404).json({ error: 'plan not found' });
      return;
    }
    if (plan === 'profile_not_found') {
      res.status(400).json({
        error: 'invalid plan',
        fields: { profileId: ['Profile not found'] },
      });
      return;
    }
    if (plan === 'profile_archived') {
      res.status(409).json({ error: 'profile is archived' });
      return;
    }
    res.json(plan);
  },
);

plansRouter.delete(
  '/:id',
  async (req: Request<IdParams>, res: Response<ApiErrorBody>) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'plan not found' });
      return;
    }
    const deleted = await deletePlan(req.teacherId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'plan not found' });
      return;
    }
    res.status(204).end();
  },
);

plansRouter.post(
  '/:planId/blocks',
  async (
    req: Request<PlanIdParams, Block | ApiErrorBody, unknown>,
    res: Response<Block | ApiErrorBody>,
  ) => {
    if (!isUuid(req.params.planId)) {
      res.status(404).json({ error: 'plan not found' });
      return;
    }
    const result = blockCreateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'invalid block',
        fields: z.flattenError(result.error).fieldErrors,
      });
      return;
    }
    const block = await insertBlock(
      req.teacherId!,
      req.params.planId,
      result.data,
    );
    if (block === undefined) {
      res.status(404).json({ error: 'plan not found' });
      return;
    }
    if (block === 'invalid_times') {
      res.status(400).json({
        error: 'invalid block',
        fields: { endMinutes: ['End time must be after start time'] },
      });
      return;
    }
    res.status(201).json(block);
  },
);
