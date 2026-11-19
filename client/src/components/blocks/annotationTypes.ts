import type { AnnotationType } from '@prep-period/shared';

// the label the app shows for each annotation type, from most to least urgent
export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  must_know: 'Must know',
  heads_up: 'Heads up',
  good_to_know: 'Good to know',
  if_time: "If there's time",
};
