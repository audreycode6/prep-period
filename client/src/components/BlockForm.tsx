import { useState, type SubmitEvent } from 'react';
import { timeInputToMinutes } from '@prep-period/shared';
import { errorMessage } from '../api/client';
import { addBlock } from '../api/plans';

type Props = { planId: string; onAdded: () => Promise<void> };

/**
 * Adds a block to the plan from a title and a start and end time. Submitting
 * stays disabled until the title is filled and both times are set with the end
 * after the start.
 */
export function BlockForm({ planId, onAdded }: Props) {
  const [title, setTitle] = useState('');
  // the time inputs' values as the browser reports them: "HH:MM" (24-hour)
  // once a whole time is entered, and "" while empty or half-filled
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  // true while an add is in flight, so a double click can't add two blocks
  const [adding, setAdding] = useState(false);

  const startMinutes = timeInputToMinutes(start);
  const endMinutes = timeInputToMinutes(end);
  const endBeforeStart =
    startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes;
  const isValid =
    title.trim() !== '' &&
    startMinutes !== null &&
    endMinutes !== null &&
    !endBeforeStart;
  const canAdd = isValid && !adding;

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid) return;

    setAdding(true);
    setError(null);
    try {
      await addBlock(planId, { title, startMinutes, endMinutes });
      setTitle('');
      setStart('');
      setEnd('');
      await onAdded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add a block</h3>
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
      <button type="submit" disabled={!canAdd}>
        Add block
      </button>
      {endBeforeStart && <p>End time must be after start time.</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
