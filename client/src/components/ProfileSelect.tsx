import { useEffect, useState } from 'react';
import type { ClassroomProfileSummary, Plan } from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { updatePlan } from '../api/plans';
import { getProfiles } from '../api/profiles';

type Props = {
  plan: Plan;
  onSaved: (plan: Plan) => void;
};

/**
 * A dropdown of the teacher's live profiles, set to the plan's profile.
 * Choosing one saves it to the plan and hands the updated plan to `onSaved`.
 * When the plan's profile is archived, it is listed but can't be chosen.
 */
export function ProfileSelect({ plan, onSaved }: Props) {
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
          onChange={(e) => handleChange(e.target.value)}
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
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
