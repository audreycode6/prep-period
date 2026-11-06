import { useEffect, useState } from 'react';
import type { Teacher } from '@prep-period/shared';
import { ApiError, errorMessage } from './api/client';
import { getCurrentTeacher } from './api/auth';
import { AuthForm } from './components/AuthForm';
import { HealthStatus } from './components/HealthStatus';
import { SignedInApp } from './components/SignedInApp';

// who is signed in, as far as the server has answered
type Auth =
  | { kind: 'checkingSession' }
  | { kind: 'signedOut' }
  | { kind: 'signedIn'; teacher: Teacher }
  // the session check failed for a reason other than no one being signed in
  | { kind: 'sessionCheckFailed'; error: string };

export default function App() {
  const [auth, setAuth] = useState<Auth>({ kind: 'checkingSession' });

  useEffect(() => {
    getCurrentTeacher()
      .then((teacher) => setAuth({ kind: 'signedIn', teacher }))
      .catch((err: unknown) =>
        setAuth(
          err instanceof ApiError && err.status === 401
            ? { kind: 'signedOut' }
            : { kind: 'sessionCheckFailed', error: errorMessage(err) },
        ),
      );
  }, []);

  return (
    <main>
      <h1>Prep Period</h1>
      <HealthStatus />
      {auth.kind === 'checkingSession' && <p>Checking sign-in...</p>}
      {auth.kind === 'sessionCheckFailed' && <p role="alert">{auth.error}</p>}
      {auth.kind === 'signedOut' && (
        <AuthForm
          onSignedIn={(teacher) => setAuth({ kind: 'signedIn', teacher })}
        />
      )}
      {auth.kind === 'signedIn' && (
        <SignedInApp
          teacher={auth.teacher}
          onSignedOut={() => setAuth({ kind: 'signedOut' })}
        />
      )}
    </main>
  );
}
