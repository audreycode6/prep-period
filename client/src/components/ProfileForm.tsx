import { useEffect, useState, type SubmitEvent } from 'react';
import {
  contactSchema,
  profileEntrySchema,
  profileFieldsSchema,
  type ClassroomProfile,
  type Contact,
  type ProfileEntry,
} from '@prep-period/shared';
import { errorMessage } from '../api/client';
import {
  createProfile,
  getProfile,
  getProfiles,
  updateProfile,
} from '../api/profiles';
import { ContactList, type ContactDraft } from './ContactList';
import { ProfileEntryList, type EntryDraft } from './ProfileEntryList';

type Props = {
  // the profile to edit, or null to create a new one
  profileId: string | null;
  onSaved: (profile: ClassroomProfile) => void;
  onClose: () => void;
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
 * A form that creates a classroom profile, or edits the one `profileId`
 * names. Save stays disabled until every field is valid. Hands the saved
 * profile to `onSaved`; Cancel calls `onClose`.
 */
export function ProfileForm({ profileId, onSaved, onClose }: Props) {
  // the profile being edited, or null for a new one
  const [profile, setProfile] = useState<ClassroomProfile | null>(null);
  // null until the load answers
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  // a teacher's only live profile is their default; with more than one,
  // they choose which
  const [hasNoLiveProfiles, setHasNoLiveProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // true while a save is in flight
  const [saving, setSaving] = useState(false);

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
    load.catch((err: unknown) => setError(errorMessage(err)));
  }, [profileId]);

  if (draft === null) {
    return (
      <section>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        {error ? <p role="alert">{error}</p> : <p>Loading profile...</p>}
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
    setSaving(true);
    setError(null);
    const fields = {
      name: draft.name,
      schoolInfo: toEntries(draft.schoolInfo),
      contacts: draft.contacts.map(
        ({ name, role, reach }): Contact => ({ name, role, reach }),
      ),
      classroomNotes: toEntries(draft.classroomNotes),
      studentNotes: toEntries(draft.studentNotes),
    };
    try {
      const saved =
        profile === null
          ? await createProfile({ ...fields, isDefault: draft.isDefault })
          : await updateProfile(
              profile.id,
              draft.isDefault === profile.isDefault
                ? fields
                : { ...fields, isDefault: draft.isDefault },
            );
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
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
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
