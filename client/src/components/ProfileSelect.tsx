import { useEffect, useState } from 'react';
import type { ClassroomProfileSummary, Plan } from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { updatePlan } from '../api/plans';
import { getProfiles } from '../api/profiles';

type Props = {
  plan: Plan;
  onSaved: (plan: Plan) => void;
  onNewProfile: () => void;
};

// the value of the option that opens a new profile,
// which onChange checks to open the form
const NEW_PROFILE = 'new';

/**
 * A dropdown of the teacher's live profiles and an option to create a new
 * one, set to the plan's profile. Choosing a profile saves it to the plan and
 * hands the updated plan to `onSaved`; choosing to create one calls
 * `onNewProfile`. An archived plan profile is listed but can't be chosen.
 */
export function ProfileSelect({ plan, onSaved, onNewProfile }: Props) {
  // null while the profile list loads, so loading and an empty list differ
  const [profiles, setProfiles] = useState<ClassroomProfileSummary[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  // true while a save is in flight
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfiles()
      .then(setProfiles)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  async function handleChange(profileId: string) {
    setSaving(true);
    setError(null);
    try {
      onSaved(await updatePlan(plan.id, { profileId }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const liveProfiles = profiles ?? [];
  const planProfileInList = liveProfiles.some(
    (profile) => profile.id === plan.profile.id,
  );

  return (
    <div>
      <label>
        Classroom profile
        <select
          value={plan.profile.id}
          disabled={profiles === null || saving}
          onChange={(e) =>
            e.target.value === NEW_PROFILE
              ? onNewProfile()
              : handleChange(e.target.value)
          }
        >
          {/* archived, or the list hasn't loaded:
              show it so the select isn't blank */}
          {!planProfileInList && (
            <option value={plan.profile.id} disabled={plan.profile.isArchived}>
              {plan.profile.name}
              {plan.profile.isArchived && ' (archived)'}
            </option>
          )}
          {liveProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
              {profile.isDefault && ' (default)'}
            </option>
          ))}
          <option value={NEW_PROFILE}>New classroom profile...</option>
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
