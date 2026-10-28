import { z } from 'zod';

export type HealthResponse = {
  status: 'ok';
  timestamp: string;
};

export type ApiErrorBody = {
  error: string;
  fields?: Record<string, string[] | undefined>;
};

export type Teacher = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type SignupRequest = {
  email: string;
  password: string;
};

export type LoginRequest = SignupRequest;

const requiredText = z.string().trim().min(1);

export const profileEntrySchema = z.object({
  label: requiredText,
  note: requiredText,
});
export type ProfileEntry = z.infer<typeof profileEntrySchema>;

export const contactSchema = z.object({
  name: requiredText,
  role: requiredText,
  reach: z.string().trim().default(''),
});
export type Contact = z.infer<typeof contactSchema>;

export const profileFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  isDefault: z.boolean(),
  schoolInfo: z.array(profileEntrySchema),
  contacts: z.array(contactSchema),
  classroomNotes: z.array(profileEntrySchema),
  studentNotes: z.array(profileEntrySchema),
});

export const profileCreateSchema = profileFieldsSchema.extend({
  isDefault: z.boolean().default(false),
  schoolInfo: profileFieldsSchema.shape.schoolInfo.default([]),
  contacts: profileFieldsSchema.shape.contacts.default([]),
  classroomNotes: profileFieldsSchema.shape.classroomNotes.default([]),
  studentNotes: profileFieldsSchema.shape.studentNotes.default([]),
});

export const profileUpdateSchema = profileFieldsSchema.partial();

export type ProfileCreate = z.infer<typeof profileCreateSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export type ClassroomProfile = z.infer<typeof profileFieldsSchema> & {
  id: string;
  // a plan or block points at it, so it can be archived but not deleted
  inUse: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClassroomProfileSummary = Pick<
  ClassroomProfile,
  'id' | 'name' | 'isDefault' | 'inUse'
>;
