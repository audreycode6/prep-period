import type { Knex } from 'knex';
import type {
  ClassroomProfile,
  ClassroomProfileSummary,
  Contact,
  ProfileCreate,
  ProfileEntry,
  ProfileUpdate,
} from '@prep-period/shared';
import { db } from '../db.js';

type ProfileRow = {
  id: string;
  teacher_id: string;
  name: string;
  is_default: boolean;
  school_info: ProfileEntry[];
  contacts: Contact[];
  classroom_notes: ProfileEntry[];
  student_notes: ProfileEntry[];
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

// A row plus whether a plan or block points at it, computed per query.
type ProfileRowWithInUse = ProfileRow & { in_use: boolean };

// blocks.profile_id is ON DELETE SET NULL: deleting would quietly clear a block's profile
const IN_USE = db.raw(
  `(exists (select 1 from plans where plans.profile_id = classroom_profiles.id)
    or exists (select 1 from blocks where blocks.profile_id = classroom_profiles.id)) as in_use`,
);

function profilesWithInUse(query: Knex | Knex.Transaction) {
  return query<ProfileRowWithInUse>('classroom_profiles').select(
    'classroom_profiles.*',
    IN_USE,
  );
}

function toProfile(row: ProfileRowWithInUse): ClassroomProfile {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    schoolInfo: row.school_info,
    contacts: row.contacts,
    classroomNotes: row.classroom_notes,
    studentNotes: row.student_notes,
    inUse: row.in_use,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
function toSummary(row: ProfileRowWithInUse): ClassroomProfileSummary {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    inUse: row.in_use,
  };
}

export async function listProfiles(
  teacherId: string,
): Promise<ClassroomProfileSummary[]> {
  const rows = await profilesWithInUse(db)
    .where({ teacher_id: teacherId })
    .whereNull('archived_at')
    .orderBy([{ column: 'is_default', order: 'desc' }, 'name']);
  return rows.map(toSummary);
}

export async function findProfile(
  teacherId: string,
  id: string,
): Promise<ClassroomProfile | undefined> {
  const row = await profilesWithInUse(db)
    .where({ id, teacher_id: teacherId })
    .whereNull('archived_at')
    .first();
  return row ? toProfile(row) : undefined;
}

async function clearDefault(
  trx: Knex.Transaction,
  teacherId: string,
): Promise<void> {
  await trx('classroom_profiles')
    .where({ teacher_id: teacherId, is_default: true })
    .update({ is_default: false });
}

/**
 * True when removing this profile would leave other live profiles with no
 * default: the teacher has to move the default first.
 */
async function needsNewDefault(
  trx: Knex.Transaction,
  teacherId: string,
  existing: { id: string; is_default: boolean },
): Promise<boolean> {
  if (!existing.is_default) return false;
  const otherLiveProfile = await trx('classroom_profiles')
    .where({ teacher_id: teacherId })
    .whereNull('archived_at')
    .whereNot({ id: existing.id })
    .first('id');
  return otherLiveProfile !== undefined;
}

export async function insertProfile(
  teacherId: string,
  input: ProfileCreate,
): Promise<ClassroomProfile> {
  return db.transaction(async (trx) => {
    const [{ count }] = await trx('classroom_profiles')
      .where({ teacher_id: teacherId })
      .whereNull('archived_at')
      .count('* as count');

    const isDefault = Number(count) === 0 || input.isDefault;
    if (isDefault) {
      await clearDefault(trx, teacherId);
    }

    const [row]: ProfileRow[] = await trx('classroom_profiles')
      .insert({
        teacher_id: teacherId,
        name: input.name,
        is_default: isDefault,
        school_info: JSON.stringify(input.schoolInfo),
        contacts: JSON.stringify(input.contacts),
        classroom_notes: JSON.stringify(input.classroomNotes),
        student_notes: JSON.stringify(input.studentNotes),
      })
      .returning('*');
    return toProfile({ ...row, in_use: false }); // nothing points at it yet
  });
}

/**
 * Applies a partial update: only the fields present in input change, and
 * setting isDefault: true moves the default here from the teacher's old one.
 * Returns:
 * the updated profile: done
 * 'needs_new_default': isDefault: false on the current default; move the
 *   default by setting isDefault: true on another profile instead
 * undefined: not found, not yours, or archived
 */
export async function updateProfile(
  teacherId: string,
  id: string,
  input: ProfileUpdate,
): Promise<ClassroomProfile | 'needs_new_default' | undefined> {
  const changes: Record<string, unknown> = { updated_at: db.fn.now() };
  if (input.name !== undefined) changes.name = input.name;
  if (input.isDefault !== undefined) changes.is_default = input.isDefault;
  if (input.schoolInfo !== undefined)
    changes.school_info = JSON.stringify(input.schoolInfo);
  if (input.contacts !== undefined)
    changes.contacts = JSON.stringify(input.contacts);
  if (input.classroomNotes !== undefined)
    changes.classroom_notes = JSON.stringify(input.classroomNotes);
  if (input.studentNotes !== undefined)
    changes.student_notes = JSON.stringify(input.studentNotes);

  return db.transaction(async (trx) => {
    const existing = await trx('classroom_profiles')
      .where({ id, teacher_id: teacherId })
      .whereNull('archived_at')
      .first();

    if (!existing) return undefined;
    if (input.isDefault === false && existing.is_default) {
      return 'needs_new_default';
    }

    if (input.isDefault) {
      await clearDefault(trx, teacherId);
    }

    await trx('classroom_profiles')
      .where({ id, teacher_id: teacherId })
      .update(changes);

    const row = await profilesWithInUse(trx).where({ id }).first();
    return row && toProfile(row);
  });
}

/**
 * Deletes a profile nothing uses. Returns:
 * 'deleted': the row was removed
 * 'in_use': a plan or block points at it; archive it instead
 * 'needs_new_default': it's the default and other profiles exist
 * undefined: not found, not yours, or already archived
 */
export async function deleteProfile(
  teacherId: string,
  id: string,
): Promise<'deleted' | 'in_use' | 'needs_new_default' | undefined> {
  return db.transaction(async (trx) => {
    const existing = await profilesWithInUse(trx)
      .where({ id, teacher_id: teacherId })
      .whereNull('archived_at')
      .first();
    if (!existing) return undefined;
    if (existing.in_use) return 'in_use';
    if (await needsNewDefault(trx, teacherId, existing)) {
      return 'needs_new_default';
    }

    await trx('classroom_profiles').where({ id, teacher_id: teacherId }).del();
    return 'deleted';
  });
}

/**
 * Archives a profile: hidden from the teacher, kept for the plans that use
 * it, and no longer the default. Returns:
 * 'archived': done
 * 'needs_new_default': it's the default and other profiles exist
 * undefined: not found, not yours, or already archived
 */
export async function archiveProfile(
  teacherId: string,
  id: string,
): Promise<'archived' | 'needs_new_default' | undefined> {
  return db.transaction(async (trx) => {
    const existing = await trx('classroom_profiles')
      .where({ id, teacher_id: teacherId })
      .whereNull('archived_at')
      .first();
    if (!existing) return undefined;
    if (await needsNewDefault(trx, teacherId, existing)) {
      return 'needs_new_default';
    }

    await trx('classroom_profiles')
      .where({ id, teacher_id: teacherId })
      .update({
        archived_at: db.fn.now(),
        is_default: false,
        updated_at: db.fn.now(),
      });
    return 'archived';
  });
}
