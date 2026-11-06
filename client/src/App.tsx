import { useState } from 'react';
import { HealthStatus } from './components/HealthStatus';
import { PlanEditor } from './components/PlanEditor';
import { PlanList } from './components/PlanList';
import { ProfileForm } from './components/ProfileForm';

// the page App shows, with what that page needs to open
type Page =
  | { kind: 'planList' }
  | { kind: 'planEditor'; planId: string }
  | { kind: 'profileForm'; profileId: string | null; returnTo: Page };

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
          onClose={() => setPage({ kind: 'planList' })}
          onEditProfile={(profileId) =>
            setPage({ kind: 'profileForm', profileId, returnTo: page })
          }
        />
      )}
      {page.kind === 'profileForm' && (
        <ProfileForm
          profileId={page.profileId}
          onSaved={() => setPage(page.returnTo)}
          onClose={() => setPage(page.returnTo)}
        />
      )}
    </main>
  );
}
