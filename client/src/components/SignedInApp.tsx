import { useState } from 'react';
import type { Teacher } from '@prep-period/shared';
import { logout } from '../api/auth';
import { useRequest } from '../hooks/useRequest';
import { PlanEditor } from './PlanEditor';
import { PlanList } from './PlanList';
import { ProfileForm } from './ProfileForm';

type Props = {
  teacher: Teacher;
  onSignedOut: () => void;
};

// the page shown, with what that page needs to open
type Page =
  | { kind: 'planList' }
  | { kind: 'planEditor'; planId: string; newProfileId?: string }
  | { kind: 'profileForm'; profileId: string | null; returnTo: Page };

/**
 * The page the profile form returns to after saving. A profile created from
 * a plan returns to that plan, now using the new profile.
 */
function pageAfterProfileSave(
  form: Extract<Page, { kind: 'profileForm' }>,
  savedProfileId: string,
): Page {
  if (form.profileId === null && form.returnTo.kind === 'planEditor') {
    return { ...form.returnTo, newProfileId: savedProfileId };
  }
  return form.returnTo;
}

/**
 * The app for a signed-in teacher, opening on the plan list. Calls
 * `onSignedOut` once signing out succeeds; a failed sign out shows its error.
 */
export function SignedInApp({ teacher, onSignedOut }: Props) {
  const [page, setPage] = useState<Page>({ kind: 'planList' });
  const { pending: signingOut, error, run } = useRequest();

  function handleSignOut() {
    return run(async () => {
      await logout();
      onSignedOut();
    });
  }

  return (
    <>
      <p>
        Signed in as {teacher.email}
        <button type="button" disabled={signingOut} onClick={handleSignOut}>
          Sign out
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
      {page.kind === 'planList' && (
        <PlanList
          onOpen={(planId) => setPage({ kind: 'planEditor', planId })}
          onNewProfile={() =>
            setPage({
              kind: 'profileForm',
              profileId: null,
              returnTo: page,
            })
          }
        />
      )}
      {page.kind === 'planEditor' && (
        <PlanEditor
          planId={page.planId}
          newProfileId={page.newProfileId}
          onClose={() => setPage({ kind: 'planList' })}
          onEditProfile={(profileId) =>
            setPage({ kind: 'profileForm', profileId, returnTo: page })
          }
          onNewProfile={() =>
            setPage({
              kind: 'profileForm',
              profileId: null,
              returnTo: { kind: 'planEditor', planId: page.planId },
            })
          }
        />
      )}
      {page.kind === 'profileForm' && (
        <ProfileForm
          profileId={page.profileId}
          onSaved={(profile) => setPage(pageAfterProfileSave(page, profile.id))}
          onClose={() => setPage(page.returnTo)}
        />
      )}
    </>
  );
}
