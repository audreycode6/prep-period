import type { HealthResponse } from '@prep-period/shared';
import { apiGet } from './client';

export function getHealth() {
  return apiGet<HealthResponse>('/health');
}
