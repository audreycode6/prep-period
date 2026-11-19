// One contact while it's being edited. `key` identifies the row on screen,
// since contacts are stored without ids.
export type ContactDraft = {
  key: string;
  name: string;
  role: string;
  reach: string;
};

type Props = {
  contacts: ContactDraft[];
  // what's wrong with each contact, in order; undefined when it can be saved
  validationMessages: (string | undefined)[];
  onChange: (contacts: ContactDraft[]) => void;
};

/**
 * A profile's contacts: name, role and how to reach them, with a Remove
 * button per contact, what's wrong with a contact that can't be saved, and
 * Add contact for a blank one. Hands every change to `onChange` as the whole
 * list.
 */
export function ContactList({ contacts, validationMessages, onChange }: Props) {
  function updateContact(key: string, changes: Partial<ContactDraft>) {
    onChange(
      contacts.map((contact) =>
        contact.key === key ? { ...contact, ...changes } : contact,
      ),
    );
  }

  return (
    <fieldset>
      <legend>Contacts</legend>
      {contacts.length > 0 && (
        <ul>
          {contacts.map((contact, index) => (
            <li key={contact.key}>
              <input
                aria-label="Name"
                placeholder="Name"
                value={contact.name}
                onChange={(e) =>
                  updateContact(contact.key, { name: e.target.value })
                }
              />
              <input
                aria-label="Role"
                placeholder="Role"
                value={contact.role}
                onChange={(e) =>
                  updateContact(contact.key, { role: e.target.value })
                }
              />
              <input
                aria-label="How to reach them"
                placeholder="Phone, email or room (optional)"
                value={contact.reach}
                onChange={(e) =>
                  updateContact(contact.key, { reach: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onChange(
                    contacts.filter((other) => other.key !== contact.key),
                  )
                }
              >
                Remove
              </button>
              {validationMessages[index] && <p>{validationMessages[index]}</p>}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...contacts,
            { key: crypto.randomUUID(), name: '', role: '', reach: '' },
          ])
        }
      >
        Add contact
      </button>
    </fieldset>
  );
}
