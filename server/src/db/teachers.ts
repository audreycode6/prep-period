import type { Teacher } from '@prep-period/shared';
import { db } from '../db.js';

type TeacherRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
};

export function toTeacher(row: TeacherRow): Teacher {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findTeacherByEmail(
  email: string,
): Promise<TeacherRow | undefined> {
  return db<TeacherRow>('teachers')
    .whereRaw('lower(email) = lower(?)', [email])
    .first();
}

export async function findTeacherById(
  id: string,
): Promise<TeacherRow | undefined> {
  return db<TeacherRow>('teachers').where({ id }).first();
}

export async function insertTeacher(
  email: string,
  passwordHash: string,
): Promise<TeacherRow | null> {
  try {
    const [row] = await db<TeacherRow>('teachers')
      .insert({ email, password_hash: passwordHash })
      .returning('*');
    return row;
  } catch (err) {
    if (isUniqueViolation(err, 'teachers_email_lower_unique')) {
      return null;
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown, constraint: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === '23505' &&
    'constraint' in err &&
    err.constraint === constraint
  );
}
