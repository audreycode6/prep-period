import {
  annotationTypeSchema,
  formatDuration,
  minutesToDisplay,
  type Activity,
  type Annotation,
  type Block,
} from '@prep-period/shared';
import { ANNOTATION_TYPE_LABELS } from '../blocks/annotationTypes';

type Props = {
  block: Block;
};

/**
 * The activity's minutes as hours and minutes, or "flexible" when it has none.
 */
function formatActivityMinutes(activity: Activity) {
  return activity.minutes === null
    ? 'flexible'
    : formatDuration(activity.minutes);
}

/**
 * Annotations as paragraphs in urgency order, each led by its type's label.
 * Annotations of the same type keep their order.
 */
function AnnotationsView({ annotations }: { annotations: Annotation[] }) {
  const typesByUrgency = annotationTypeSchema.options;
  const annotationsByUrgency = annotations.toSorted(
    (a, b) => typesByUrgency.indexOf(a.type) - typesByUrgency.indexOf(b.type),
  );
  return annotationsByUrgency.map((annotation) => (
    <p key={annotation.id} data-annotation-type={annotation.type}>
      <b>{ANNOTATION_TYPE_LABELS[annotation.type]}:</b> {annotation.text}
    </p>
  ));
}

/**
 * A block, with whole-block annotations before its activities and each
 * activity's annotations under it.
 */
export function BlockView({ block }: Props) {
  return (
    <section className="block-view">
      <h4>
        {minutesToDisplay(block.startMinutes)}–
        {minutesToDisplay(block.endMinutes)} {block.title}
      </h4>
      {block.description && <p>{block.description}</p>}
      <AnnotationsView
        annotations={block.annotations.filter(
          (annotation) => annotation.activityId === null,
        )}
      />
      {block.activities.length > 0 && (
        <ol>
          {block.activities.map((activity) => (
            <li key={activity.id}>
              {activity.label} · {formatActivityMinutes(activity)}
              {activity.steps.length > 0 && (
                <ol type="a">
                  {activity.steps.map((step, index) => (
                    <li key={index}>{step.text}</li>
                  ))}
                </ol>
              )}
              <AnnotationsView
                annotations={block.annotations.filter(
                  (annotation) => annotation.activityId === activity.id,
                )}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
