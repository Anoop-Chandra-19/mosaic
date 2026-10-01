import type { LiveEdit } from '@/stores/liveEditStore';
import type { ResumeEntry } from '@shared/types/resume';

/** A placeholder id for a bullet still being written. */
const NEW_BULLET_ID = 'live-new-bullet';

const changeEntry =
  (entryId: string, change: (entry: ResumeEntry) => ResumeEntry): LiveEdit =>
  (resume) => ({
    ...resume,
    sections: resume.sections.map((section) =>
      section.items.some((entry) => entry.id === entryId)
        ? {
            ...section,
            items: section.items.map((entry) => (entry.id === entryId ? change(entry) : entry)),
          }
        : section
    ),
  });

export const showEntryFields = (
  entryId: string,
  fields: Partial<Pick<ResumeEntry, 'title' | 'organization' | 'location' | 'dates' | 'text'>>
) => changeEntry(entryId, (entry) => ({ ...entry, ...fields }));

export const showBulletText = (entryId: string, bulletId: string, text: string) =>
  changeEntry(entryId, (entry) => ({
    ...entry,
    bullets: entry.bullets.map((bullet) => (bullet.id === bulletId ? { ...bullet, text } : bullet)),
  }));

/** A bullet being added after `afterBulletId`, or at the end. */
export const showNewBullet = (entryId: string, text: string, afterBulletId?: string) =>
  changeEntry(entryId, (entry) => {
    const bullets = [...entry.bullets];
    const at = afterBulletId
      ? bullets.findIndex((bullet) => bullet.id === afterBulletId) + 1
      : bullets.length;
    bullets.splice(at, 0, { id: NEW_BULLET_ID, text, selected: true });
    return { ...entry, bullets };
  });

export const showSectionLabel =
  (sectionId: string, label: string): LiveEdit =>
  (resume) => ({
    ...resume,
    sections: resume.sections.map((section) =>
      section.id === sectionId ? { ...section, label } : section
    ),
  });

export const showName =
  (name: string): LiveEdit =>
  (resume) => ({ ...resume, contact: { ...resume.contact, name } });

export const showHeaderItemText =
  (itemId: string, text: string): LiveEdit =>
  (resume) => ({
    ...resume,
    contact: {
      ...resume.contact,
      header: {
        ...resume.contact.header,
        lines: resume.contact.header.lines.map((line) => ({
          ...line,
          items: line.items.map((item) => (item.id === itemId ? { ...item, text } : item)),
        })),
      },
    },
  });
