import { useState } from 'react';
import { HealthStatus } from './components/HealthStatus';
import { PlanEditor } from './components/PlanEditor';
import { PlanList } from './components/PlanList';
import { ProfileForm } from './components/ProfileForm';

// the page App shows, with what that page needs to open
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

export default function App() {
  const [page, setPage] = useState<Page>({ kind: 'planList' });

  return (
    <main>
      <h1>Prep Period</h1>
      <HealthStatus />
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
    </main>
  );
}
