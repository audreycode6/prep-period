import type {
  Activity,
  ActivityInputRequest,
  Annotation,
  AnnotationInputRequest,
  Block,
  BlockUpdate,
} from '@prep-period/shared';
import { apiDel, apiPatch, apiPut } from './client';

/**
 * Updates only the fields present in `changes` and
 * returns the updated plan with its blocks
 */
export function updateBlock(id: string, changes: BlockUpdate) {
  return apiPatch<Block>(`/blocks/${id}`, changes);
}

/**
 * Deletes the block along with its activities and annotations.
 */
export function deleteBlock(id: string) {
  return apiDel(`/blocks/${id}`);
}

/**
 * Saves `activities` as the block's whole activity list, in order. An item
 * with an id updates that activity, one without is created, and any
 * activity left out is deleted.
 */
export function saveActivities(
  blockId: string,
  activities: ActivityInputRequest[],
) {
  return apiPut<Activity[]>(`/blocks/${blockId}/activities`, activities);
}

/**
 * Saves `annotations` as the block's whole annotation list, in order,
 * replacing the old one, and returns the saved list.
 */
export function saveAnnotations(
  blockId: string,
  annotations: AnnotationInputRequest[],
) {
  return apiPut<Annotation[]>(`/blocks/${blockId}/annotations`, annotations);
}
