import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  profileCreateSchema,
  profileUpdateSchema,
  type ClassroomProfile,
  type ClassroomProfileSummary,
} from '@prep-period/shared';
import {
  archiveProfile,
  countPlansForProfile,
  findProfile,
  insertProfile,
  listProfiles,
  updateProfile,
} from '../db/profiles.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const profilesRouter = Router();
profilesRouter.use(requireAuth);

type ApiError = {
  error: string;
  fields?: Record<string, string[] | undefined>;
};
type IdParams = { id: string };

function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

profilesRouter.get(
  '/',
  async (req: Request, res: Response<ClassroomProfileSummary[]>) => {
    res.json(await listProfiles(req.teacherId!));
  },
);

profilesRouter.post(
  '/',
  async (
    req: Request<Record<string, never>, ClassroomProfile | ApiError, unknown>,
    res: Response<ClassroomProfile | ApiError>,
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
    res: Response<ClassroomProfile | ApiError>,
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
    req: Request<IdParams, ClassroomProfile | ApiError, unknown>,
    res: Response<ClassroomProfile | ApiError>,
  ) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    const result = profileUpdateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'update fail',
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
      res.status(404);
      return;
    }
    res.json(profile);
  },
);

profilesRouter.delete(
  '/:id',
  async (req: Request<IdParams>, res: Response<ApiError>) => {
    if (!isUuid(req.params.id)) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    const planCount = await countPlansForProfile(req.teacherId!, req.params.id);
    if (planCount > 0) {
      res
        .status(409)
        .json({ error: `profile is used by ${planCount} plan(s)` });
      return;
    }
    const archived = await archiveProfile(req.teacherId!, req.params.id);
    if (archived === undefined) {
      res.status(404);
      return;
    }
    res.status(204).end();
  },
);
