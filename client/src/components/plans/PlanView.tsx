import { dateToDisplay, type Plan } from '@prep-period/shared';
import { BlockView } from './BlockView';
import { EntriesView } from './EntriesView';

type Props = {
  plan: Plan;
};

/**
 * The whole plan, read-only, in a fixed section order. A section with
 * nothing in it is left out along with its heading, and a plan with no date
 * shows no date line.
 */
export function PlanView({ plan }: Props) {
  const { profile } = plan;
  const contactEntries = profile.contacts.map(({ name, role, reach }) => ({
    label: name,
    note: reach === '' ? role : `${role} · ${reach}`,
  }));
  const profileHasEntries =
    profile.schoolInfo.length > 0 ||
    contactEntries.length > 0 ||
    profile.classroomNotes.length > 0;

  return (
    <article className="plan-view">
      <h2>{plan.title}</h2>
      {plan.date && <p>{dateToDisplay(plan.date)}</p>}
      {plan.todayNote && (
        <section className="today-note">
          <h3>Today</h3>
          <p>{plan.todayNote}</p>
        </section>
      )}
      {profileHasEntries && (
        <section>
          <h3>Classroom profile: {profile.name}</h3>
          {profile.schoolInfo.length > 0 && (
            <>
              <h4>School info</h4>
              <EntriesView entries={profile.schoolInfo} />
            </>
          )}
          {contactEntries.length > 0 && (
            <>
              <h4>Contacts</h4>
              <EntriesView entries={contactEntries} />
            </>
          )}
          {profile.classroomNotes.length > 0 && (
            <>
              <h4>Classroom notes</h4>
              <EntriesView entries={profile.classroomNotes} />
            </>
          )}
        </section>
      )}
      {profile.studentNotes.length > 0 && (
        <section>
          <h3>Student notes</h3>
          <EntriesView entries={profile.studentNotes} />
        </section>
      )}
      {plan.blocks.length > 0 && (
        <section>
          <h3>Schedule</h3>
          {plan.blocks.map((block) => (
            <BlockView key={block.id} block={block} />
          ))}
        </section>
      )}
    </article>
  );
}
