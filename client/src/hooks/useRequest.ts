import { useState } from 'react';
import { errorMessage } from '../api/client';

/**
 * Runs a request and tracks whether it's in flight and why it failed. A
 * failure is caught rather than thrown, and turned into a message by
 * `toMessage`.
 */
export function useRequest(toMessage: (err: unknown) => string = errorMessage) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(request: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await request();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setPending(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return { pending, error, run, clearError };
}
