import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  profileCreateSchema,
  profileUpdateSchema,
  type ApiErrorBody,
  type ClassroomProfile,
  type ClassroomProfileSummary,
} from '@prep-period/shared';
import {
  archiveProfile,
  deleteProfile,
  findProfile,
  insertProfile,
  listProfiles,
  updateProfile,
} from '../db/profiles.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { isUuid } from './validation.js';

export const profilesRouter = Router();
profilesRouter.use(requireAuth);

type IdParams = { id: string };

profilesRouter.get(
  '/',
  async (req: Request, res: Response<ClassroomProfileSummary[]>) => {
    res.json(await listProfiles(req.teacherId!));
  },
);

profilesRouter.post(
  '/',
  async (
    req: Request<
      Record<string, never>,
      ClassroomProfile | ApiErrorBody,
      unknown
    >,
    res: Response<ClassroomProfile | ApiErrorBody>,
  ) => {
    const result = profileCreateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'invalid profile',
        fields: z.flattenError(result.error).fieldErrors,
      });
      return;
    }
    const profile = await insertProfile(req.teacherId!, result.data);
    res.status(201).json(profile);
  },
);

profilesRouter.get(
  '/:id',
  async (
    req: Request<IdParams>,
    res: Response<ClassroomProfile | ApiErrorBody>,
  ) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    const profile = await findProfile(req.teacherId!, req.params.id);
    if (profile === undefined) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    res.json(profile);
  },
);

profilesRouter.patch(
  '/:id',
  async (
    req: Request<IdParams, ClassroomProfile | ApiErrorBody, unknown>,
    res: Response<ClassroomProfile | ApiErrorBody>,
  ) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    const result = profileUpdateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'invalid profile',
        fields: z.flattenError(result.error).fieldErrors,
      });
      return;
    }
    const profile = await updateProfile(
      req.teacherId!,
      req.params.id,
      result.data,
    );
    if (profile === undefined) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    if (profile === 'needs_new_default') {
      res.status(409).json({ error: 'choose a new default first' });
      return;
    }
    res.json(profile);
  },
);

profilesRouter.delete(
  '/:id',
  async (req: Request<IdParams>, res: Response<ApiErrorBody>) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    const result = await deleteProfile(req.teacherId!, req.params.id);
    if (result === undefined) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    if (result === 'in_use') {
      res.status(409).json({ error: 'profile in use' });
      return;
    }
    if (result === 'needs_new_default') {
      res.status(409).json({ error: 'choose a new default first' });
      return;
    }
    res.status(204).end();
  },
);

profilesRouter.post(
  '/:id/archive',
  async (req: Request<IdParams>, res: Response<ApiErrorBody>) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    const result = await archiveProfile(req.teacherId!, req.params.id);
    if (result === undefined) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    if (result === 'needs_new_default') {
      res.status(409).json({ error: 'choose a new default first' });
      return;
    }
    res.status(204).end();
  },
);
