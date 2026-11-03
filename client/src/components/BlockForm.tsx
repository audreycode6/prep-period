import { useState, type SubmitEvent } from 'react';
import {
  minutesToTimeInput,
  timeInputToMinutes,
  type Block,
} from '@prep-period/shared';
import { errorMessage } from '../api/client';

export type BlockFormValues = Pick<
  Block,
  'title' | 'startMinutes' | 'endMinutes'
>;

type Props = {
  // the block's current values when editing; omit for an empty new-block form
  blockToEdit?: BlockFormValues;
  submitLabel: string;
  onSubmit: (values: BlockFormValues) => Promise<void>;
  onCancel?: () => void;
};

/**
 * Form for a block's title and times, used both to add a block and to edit
 * one. With `blockToEdit` it starts from that block's values; without it, it
 * starts empty and clears after each submit. Submit stays disabled until the
 * title is filled and the end is after the start, and an error thrown by
 * `onSubmit` shows under the form.
 */
export function BlockForm({
  blockToEdit,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(blockToEdit?.title ?? '');
  // the time inputs' values as the browser reports them: "HH:MM" (24-hour)
  // once a whole time is entered, and "" while empty or half-filled
  const [start, setStart] = useState(
    blockToEdit ? minutesToTimeInput(blockToEdit.startMinutes) : '',
  );
  const [end, setEnd] = useState(
    blockToEdit ? minutesToTimeInput(blockToEdit.endMinutes) : '',
  );
  const [error, setError] = useState<string | null>(null);
  // true while a submit is in flight, so a double click can't send it twice
  const [submitting, setSubmitting] = useState(false);

  const startMinutes = timeInputToMinutes(start);
  const endMinutes = timeInputToMinutes(end);
  const endBeforeStart =
    startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes;
  const isValid =
    title.trim() !== '' &&
    startMinutes !== null &&
    endMinutes !== null &&
    !endBeforeStart;
  const canSubmit = isValid && !submitting;

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title, startMinutes, endMinutes });
      if (!blockToEdit) {
        setTitle('');
        setStart('');
        setEnd('');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Title
        <input
          value={title}
          maxLength={255}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Start
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        End
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <button type="submit" disabled={!canSubmit}>
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
      {endBeforeStart && <p>End time must be after start time.</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
