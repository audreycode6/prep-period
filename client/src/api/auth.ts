import type { LoginRequest, SignupRequest, Teacher } from '@prep-period/shared';
import { apiGet, apiPost } from './client';

/**
 * Gets the signed-in teacher. Throws an ApiError with status 401 when no one
 * is signed in.
 */
export function getCurrentTeacher() {
  return apiGet<Teacher>('/auth/me');
}

/**
 * Creates an account, signs it in and returns its teacher.
 */
export function signup(credentials: SignupRequest) {
  return apiPost<Teacher>('/auth/signup', credentials);
}

/**
 * Signs a teacher in and returns them.
 */
export function login(credentials: LoginRequest) {
  return apiPost<Teacher>('/auth/login', credentials);
}

/**
 * Signs the current teacher out.
 */
export function logout() {
  return apiPost<void>('/auth/logout');
}
