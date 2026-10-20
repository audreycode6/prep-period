import { useEffect, useState } from 'react';
import type { HealthResponse } from '@prep-period/shared';
import { getHealth } from '../api/health';

export function HealthStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p>API error: {error}</p>;
  if (!health) return <p>Checking API...</p>;

  return (
    <p>
      API status: {health.status} at {health.timestamp}
    </p>
  );
}
