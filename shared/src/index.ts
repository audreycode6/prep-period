import { z } from 'zod';
import { MINUTES_PER_DAY } from './time.js';

export * from './time.js';

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
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClassroomProfileSummary = Pick<
  ClassroomProfile,
  'id' | 'name' | 'isDefault' | 'inUse' | 'isArchived'
>;

// minutes since midnight
const minutesOfDay = z.int().min(0).lt(MINUTES_PER_DAY);

export const planFieldsSchema = z.object({
  title: requiredText.max(255),
  date: z.iso.date().nullable(),
  todayNote: z.string().trim().nullable(),
  // omitted on create: the server uses the teacher's default profile
  profileId: z.uuid().optional(),
});

export const planCreateSchema = planFieldsSchema.extend({
  date: planFieldsSchema.shape.date.default(null),
  todayNote: planFieldsSchema.shape.todayNote.default(null),
});

export const planUpdateSchema = planFieldsSchema.partial();

export type PlanCreate = z.infer<typeof planCreateSchema>;
// what a client sends: date and todayNote may be left out
export type PlanCreateRequest = z.input<typeof planCreateSchema>;
export type PlanUpdate = z.infer<typeof planUpdateSchema>;

export const blockFieldsSchema = z.object({
  title: requiredText.max(255),
  description: z.string().trim().nullable(),
  startMinutes: minutesOfDay,
  endMinutes: minutesOfDay,
});

export const blockCreateSchema = blockFieldsSchema.extend({
  description: blockFieldsSchema.shape.description.default(null),
});

export const blockUpdateSchema = blockFieldsSchema.partial();

export type BlockCreate = z.infer<typeof blockCreateSchema>;
export type BlockUpdate = z.infer<typeof blockUpdateSchema>;
// what a client sends: description may be left out
export type BlockCreateRequest = z.input<typeof blockCreateSchema>;

export const activityStepSchema = z.object({ text: requiredText });
export type ActivityStep = z.infer<typeof activityStepSchema>;

export const activityFieldsSchema = z.object({
  label: requiredText,
  steps: z.array(activityStepSchema),
  minutes: z.int().positive().nullable(), // null = flexible
});

// A block's activities are always saved as a whole list. An item with an id
// updates that activity in place, so annotations pointing at it survive.
export const activityInputSchema = activityFieldsSchema.extend({
  id: z.uuid().optional(),
  steps: activityFieldsSchema.shape.steps.default([]),
  minutes: activityFieldsSchema.shape.minutes.default(null),
});

export const activitiesReplaceSchema = z.array(activityInputSchema);

export type ActivityInput = z.infer<typeof activityInputSchema>;
// what a client sends: steps and minutes may be left out
export type ActivityInputRequest = z.input<typeof activityInputSchema>;

export type Activity = z.infer<typeof activityFieldsSchema> & { id: string };

// the values annotations_type_check allows, from most to least urgent
export const annotationTypeSchema = z.enum([
  'must_know',
  'heads_up',
  'good_to_know',
  'if_time',
]);
export type AnnotationType = z.infer<typeof annotationTypeSchema>;

export const annotationFieldsSchema = z.object({
  // null = the whole block; set, one of the block's activities
  activityId: z.uuid().nullable(),
  type: annotationTypeSchema,
  text: requiredText,
});

// One annotation as sent in a block's annotation list: a missing activityId
// becomes null, a note on the whole block.
export const annotationInputSchema = annotationFieldsSchema.extend({
  activityId: annotationFieldsSchema.shape.activityId.default(null),
});

export const annotationsReplaceSchema = z.array(annotationInputSchema);

export type AnnotationInput = z.infer<typeof annotationInputSchema>;
// what a client sends, before activityId's default applies
export type AnnotationInputRequest = z.input<typeof annotationInputSchema>;

export type Annotation = z.infer<typeof annotationFieldsSchema> & {
  id: string;
};

export type Block = z.infer<typeof blockFieldsSchema> & {
  id: string;
  activities: Activity[];
  // block-wide and per-activity annotations together, in their saved order
  annotations: Annotation[];
};

export type Plan = Omit<z.infer<typeof planFieldsSchema>, 'profileId'> & {
  id: string;
  // resolved even when archived, so an old plan still shows its profile
  profile: ClassroomProfile;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
};

export type PlanSummary = Pick<Plan, 'id' | 'title' | 'date' | 'updatedAt'> & {
  profile: Pick<ClassroomProfile, 'id' | 'name' | 'isArchived'>;
};
