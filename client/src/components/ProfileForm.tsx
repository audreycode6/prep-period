import { useEffect, useState, type SubmitEvent } from 'react';
import {
  contactSchema,
  profileEntrySchema,
  profileFieldsSchema,
  type ClassroomProfile,
  type Contact,
  type ProfileCreate,
  type ProfileEntry,
} from '@prep-period/shared';
import { errorMessage } from '../api/client';
import {
  createProfile,
  getProfile,
  getProfiles,
  updateProfile,
} from '../api/profiles';
import {
  useReportUnsavedChanges,
  type OnUnsavedChange,
} from '../hooks/unsavedChanges';
import { useRequest } from '../hooks/useRequest';
import { ContactList, type ContactDraft } from './ContactList';
import { ProfileEntryList, type EntryDraft } from './ProfileEntryList';

type Props = {
  // the profile to edit, or null to create a new one
  profileId: string | null;
  onSaved: (profile: ClassroomProfile) => void;
  onClose: () => void;
  onUnsavedChange?: OnUnsavedChange;
};

// the form's fields while they're being edited
type ProfileDraft = {
  name: string;
  isDefault: boolean;
  schoolInfo: EntryDraft[];
  contacts: ContactDraft[];
  classroomNotes: EntryDraft[];
  studentNotes: EntryDraft[];
};

/**
 * Turns entries into drafts, each with a new key.
 */
function toEntryDrafts(entries: ProfileEntry[]): EntryDraft[] {
  return entries.map((entry) => ({ key: crypto.randomUUID(), ...entry }));
}

/**
 * Turns drafts into entries: each one's label and note, without its key.
 */
function toEntries(drafts: EntryDraft[]): ProfileEntry[] {
  return drafts.map(({ label, note }) => ({ label, note }));
}

/**
 * Converts a saved profile into a draft for editing, or makes a blank draft
 * when there is none.
 */
function toDraft(profile: ClassroomProfile | null): ProfileDraft {
  return {
    name: profile?.name ?? '',
    isDefault: profile?.isDefault ?? false,
    schoolInfo: toEntryDrafts(profile?.schoolInfo ?? []),
    contacts: (profile?.contacts ?? []).map((contact) => ({
      key: crypto.randomUUID(),
      ...contact,
    })),
    classroomNotes: toEntryDrafts(profile?.classroomNotes ?? []),
    studentNotes: toEntryDrafts(profile?.studentNotes ?? []),
  };
}

/**
 * Converts a draft into the fields Save sends, without the rows' keys.
 */
function toFields(draft: ProfileDraft): ProfileCreate {
  return {
    name: draft.name,
    isDefault: draft.isDefault,
    schoolInfo: toEntries(draft.schoolInfo),
    contacts: draft.contacts.map(
      ({ name, role, reach }): Contact => ({ name, role, reach }),
    ),
    classroomNotes: toEntries(draft.classroomNotes),
    studentNotes: toEntries(draft.studentNotes),
  };
}

/**
 * A form that creates a classroom profile, or edits the one `profileId`
 * names. Save stays disabled until every field is valid. Hands the saved
 * profile to `onSaved`; Cancel calls `onClose`.
 */
export function ProfileForm({
  profileId,
  onSaved,
  onClose,
  onUnsavedChange,
}: Props) {
  // the profile being edited, or null for a new one
  const [profile, setProfile] = useState<ClassroomProfile | null>(null);
  // null until the load answers
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  // a teacher's only live profile is their default; with more than one,
  // they choose which
  const [hasNoLiveProfiles, setHasNoLiveProfiles] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { pending: saving, error: saveError, run } = useRequest();

  useEffect(() => {
    const load =
      profileId === null
        ? // a new profile: count live profiles for the default rule, start blank
          getProfiles().then((profiles) => {
            setHasNoLiveProfiles(profiles.length === 0);
            setDraft(toDraft(null));
          })
        : // an existing profile: fetch it and fill the form from it
          getProfile(profileId).then((saved) => {
            setProfile(saved);
            setDraft(toDraft(saved));
          });
    load.catch((err: unknown) => setLoadError(errorMessage(err)));
  }, [profileId]);

  const hasUnsavedChanges =
    draft !== null &&
    JSON.stringify(toFields(draft)) !==
      JSON.stringify(toFields(toDraft(profile)));
  useReportUnsavedChanges(hasUnsavedChanges, onUnsavedChange);

  if (draft === null) {
    return (
      <section>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        {loadError ? (
          <p role="alert">{loadError}</p>
        ) : (
          <p>Loading profile...</p>
        )}
      </section>
    );
  }

  const nameMessage = profileFieldsSchema.shape.name.safeParse(draft.name).error
    ?.issues[0]?.message;
  const entryMessages = (entries: EntryDraft[]) =>
    entries.map(
      (entry) => profileEntrySchema.safeParse(entry).error?.issues[0]?.message,
    );
  const schoolInfoMessages = entryMessages(draft.schoolInfo);
  const classroomNoteMessages = entryMessages(draft.classroomNotes);
  const studentNoteMessages = entryMessages(draft.studentNotes);
  const contactMessages = draft.contacts.map(
    (contact) => contactSchema.safeParse(contact).error?.issues[0]?.message,
  );
  const canSave =
    !saving &&
    [
      nameMessage,
      ...schoolInfoMessages,
      ...classroomNoteMessages,
      ...studentNoteMessages,
      ...contactMessages,
    ].every((message) => message === undefined);

  function updateDraft(changes: Partial<ProfileDraft>) {
    setDraft((current) => current && { ...current, ...changes });
  }

  /**
   * Saves the form as a new profile, or as the edited one with its fields
   * set to what's in the form. On success hands the saved profile to
   * `onSaved`; on failure shows the error and lets the teacher try again.
   */
  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (draft === null) return;
    const fields = toFields(draft);
    await run(async () => {
      if (profile === null) {
        onSaved(await createProfile(fields));
        return;
      }
      // isDefault goes only when it changed
      const { isDefault, ...rest } = fields;
      onSaved(
        await updateProfile(
          profile.id,
          isDefault === profile.isDefault ? rest : fields,
        ),
      );
    });
  }

  return (
    <section>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
      <h2>{profile === null ? 'New profile' : 'Edit profile'}</h2>
      {profile?.inUse && <p>Changes apply to every plan using this profile.</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input
            value={draft.name}
            maxLength={255}
            placeholder="Room 12, 3rd grade"
            onChange={(e) => updateDraft({ name: e.target.value })}
          />
        </label>
        {nameMessage && <p>{nameMessage}</p>}
        {profile === null && hasNoLiveProfiles ? (
          <p>
            This will be your default profile. You can choose another once you
            have more than one.
          </p>
        ) : profile?.isDefault ? (
          <p>
            This is your default profile. To change that, make another profile
            the default.
          </p>
        ) : (
          <label>
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(e) => updateDraft({ isDefault: e.target.checked })}
            />
            Make this my default profile
          </label>
        )}
        <ProfileEntryList
          heading="School info"
          addLabel="Add school info"
          entries={draft.schoolInfo}
          validationMessages={schoolInfoMessages}
          onChange={(schoolInfo) => updateDraft({ schoolInfo })}
        />
        <ContactList
          contacts={draft.contacts}
          validationMessages={contactMessages}
          onChange={(contacts) => updateDraft({ contacts })}
        />
        <ProfileEntryList
          heading="Classroom notes"
          addLabel="Add classroom note"
          entries={draft.classroomNotes}
          validationMessages={classroomNoteMessages}
          onChange={(classroomNotes) => updateDraft({ classroomNotes })}
        />
        <ProfileEntryList
          heading="Student notes"
          addLabel="Add student note"
          entries={draft.studentNotes}
          validationMessages={studentNoteMessages}
          onChange={(studentNotes) => updateDraft({ studentNotes })}
        />
        <button type="submit" disabled={!canSave}>
          Save profile
        </button>
      </form>
      {saveError && <p role="alert">{saveError}</p>}
    </section>
  );
}
