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

function toProfile(row: ProfileRow): ClassroomProfile {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    schoolInfo: row.school_info,
    contacts: row.contacts,
    classroomNotes: row.classroom_notes,
    studentNotes: row.student_notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
function toSummary(row: ProfileRow): ClassroomProfileSummary {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
  };
}

export async function listProfiles(
  teacherId: string,
): Promise<ClassroomProfileSummary[]> {
  const rows = await db<ProfileRow>('classroom_profiles')
    .where({ teacher_id: teacherId })
    .whereNull('archived_at')
    .orderBy([{ column: 'is_default', order: 'desc' }, 'name']);
  return rows.map(toSummary);
}

export async function findProfile(
  teacherId: string,
  id: string,
): Promise<ClassroomProfile | undefined> {
  const row = await db<ProfileRow>('classroom_profiles')
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
    return toProfile(row);
  });
}

export async function updateProfile(
  teacherId: string,
  id: string,
  input: ProfileUpdate,
): Promise<ClassroomProfile | undefined> {
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

    if (input.isDefault) {
      await clearDefault(trx, teacherId);
    }

    const [row]: ProfileRow[] = await trx('classroom_profiles')
      .where({ id, teacher_id: teacherId })
      .update(changes)
      .returning('*');
    return toProfile(row);
  });
}

export async function archiveProfile(
  teacherId: string,
  id: string,
): Promise<ClassroomProfile | undefined> {
  const [row]: ProfileRow[] = await db('classroom_profiles')
    .where({ id, teacher_id: teacherId })
    .whereNull('archived_at')
    .update({ archived_at: db.fn.now(), updated_at: db.fn.now() })
    .returning('*');
  return row ? toProfile(row) : undefined;
}

export async function countPlansForProfile(
  teacherId: string,
  id: string,
): Promise<number> {
  const [{ count }] = await db('plans')
    .where({ profile_id: id, teacher_id: teacherId })
    .count('* as count');
  return Number(count);
}
