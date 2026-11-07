import { useState, type SubmitEvent } from 'react';
import type { Teacher } from '@prep-period/shared';
import { ApiError, errorMessage } from '../api/client';
import { login, signup } from '../api/auth';
import { useRequest } from '../hooks/useRequest';

type Props = {
  onSignedIn: (teacher: Teacher) => void;
};

/**
 * The server's reason for refusing a sign-in or new account, when it gave
 * one; otherwise the usual error message.
 */
function refusalMessage(err: unknown): string {
  // errorMessage reports every 401 as not signed in; here a 401 is a wrong
  // email or password
  return err instanceof ApiError && err.body
    ? err.body.error
    : errorMessage(err);
}

/**
 * A form that signs a teacher in, or creates an account, with an email and
 * password. A button switches between the two. Both hand the
 * signed-in teacher to `onSignedIn`; a refusal shows under the form.
 */
export function AuthForm({ onSignedIn }: Props) {
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const {
    pending: submitting,
    error,
    run,
    clearError,
  } = useRequest(refusalMessage);

  const canSubmit = !submitting && email !== '' && password !== '';

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      const credentials = { email, password };
      const teacher = isCreatingAccount
        ? await signup(credentials)
        : await login(credentials);
      onSignedIn(teacher);
    });
  }

  function toggleCreatingAccount() {
    setIsCreatingAccount(!isCreatingAccount);
    clearError();
  }

  return (
    <section>
      <h2>{isCreatingAccount ? 'Create an account' : 'Sign in'}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={
              isCreatingAccount ? 'new-password' : 'current-password'
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!canSubmit}>
          {isCreatingAccount ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <button type="button" onClick={toggleCreatingAccount}>
        {isCreatingAccount ? 'Go to Sign In' : 'Go to Account Creation'}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
