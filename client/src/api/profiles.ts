import type {
  ClassroomProfile,
  ClassroomProfileSummary,
  ProfileCreate,
  ProfileUpdate,
} from '@prep-period/shared';
import { apiGet, apiPatch, apiPost } from './client';

/**
 * Lists the teacher's live profiles, default first, then by name. Archived
 * profiles are left out.
 */
export function getProfiles() {
  return apiGet<ClassroomProfileSummary[]>('/profiles');
}

/**
 * Gets one live profile with its school info, contacts and notes.
 */
export function getProfile(id: string) {
  return apiGet<ClassroomProfile>(`/profiles/${id}`);
}

/**
 * Creates a profile and returns it.
 */
export function createProfile(profile: ProfileCreate) {
  return apiPost<ClassroomProfile>('/profiles', profile);
}

/**
 * Updates only the fields present in `changes` and returns the updated
 * profile.
 */
export function updateProfile(id: string, changes: ProfileUpdate) {
  return apiPatch<ClassroomProfile>(`/profiles/${id}`, changes);
}
