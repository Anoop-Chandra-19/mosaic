import { describe, expect, it } from 'vitest';
import { createHeaderItem, createHeaderLine } from '@shared/resume/resumeHeader';
import type { ContactInfo, HeaderItem, ResumeData, ResumeSection } from '@shared/types/resume';
import { buildImportedResume, describeImport, keepsHeader } from '../buildImportedResume';
import type { ParsedResume } from '../parseResume';

/** A contact with a name, and a header of one line holding these items. */
function contact(name = '', ...items: HeaderItem[]): ContactInfo {
  return {
    name,
    header: { linkStyle: 'plain', lines: items.length ? [createHeaderLine(items)] : [] },
  };
}

const email = (text: string) => createHeaderItem('email', { text, url: text });

function section(
  kind: ResumeSection['kind'],
  label: string,
  titles: string[],
  layout: ResumeSection['layout'] = 'entries'
): ResumeSection {
  return {
    id: crypto.randomUUID(),
    kind,
    layout,
    label,
    order: 0,
    items: titles.map((title) => ({ id: crypto.randomUUID(), selected: true, title, bullets: [] })),
  };
}

function parsed(sections: ResumeSection[], incoming: ContactInfo = contact()): ParsedResume {
  return {
    resume: { schemaVersion: 1, contact: incoming, sections },
    warnings: [],
    leftOut: [],
  };
}

describe('describeImport', () => {
  it('counts sections, entries, and bullets', () => {
    const result: ParsedResume = {
      resume: {
        schemaVersion: 1,
        contact: contact('Ada'),
        sections: [
          {
            id: 'x',
            kind: 'experience',
            layout: 'entries',
            label: 'Work Experience',
            order: 0,
            items: [
              {
                id: 'e1',
                selected: true,
                title: 'Engineer',
                bullets: [
                  { id: 'b1', text: 'a', selected: true },
                  { id: 'b2', text: 'b', selected: true },
                ],
              },
            ],
          },
        ],
      },
      warnings: [],
      leftOut: [],
    };
    expect(describeImport(result)).toEqual({
      sectionCount: 1,
      entryCount: 1,
      bulletCount: 2,
      contactName: 'Ada',
    });
  });
});

describe('buildImportedResume', () => {
  const current: ResumeData = {
    schemaVersion: 1,
    contact: contact('Existing Person', email('keep@me.com')),
    sections: [section('experience', 'Work Experience', ['Old Job'])],
  };

  it('new and replace take the imported document as it is', () => {
    const imported = parsed([section('education', 'Education', ['B.S. CS'])], contact('New Name'));
    for (const mode of ['new', 'replace'] as const) {
      const result = buildImportedResume(current, imported, mode);
      expect(result.sections.map((s) => s.kind)).toEqual(['education']);
      expect(result.contact.name).toBe('New Name');
    }
  });

  it('merge appends into same-type sections and adds new ones', () => {
    const result = buildImportedResume(
      current,
      parsed([
        section('experience', 'Work Experience', ['New Job']),
        section('skills', 'Skills', ['TypeScript']),
      ]),
      'merge'
    );
    const experience = result.sections.find((s) => s.kind === 'experience');
    expect(experience?.items.map((i) => i.title)).toEqual(['Old Job', 'New Job']);
    expect(result.sections.some((s) => s.kind === 'skills')).toBe(true);
    // The document it merged into is left alone.
    expect(current.sections[0].items.map((i) => i.title)).toEqual(['Old Job']);
  });

  it('merge puts a custom section into the one of the same name, not any custom section', () => {
    const withCustom: ResumeData = {
      ...current,
      sections: [...current.sections, section('custom', 'Volunteering', ['Food bank'])],
    };
    const result = buildImportedResume(
      withCustom,
      parsed([
        section('custom', 'volunteering ', ['Shelter']),
        section('custom', 'Publications', ['A paper']),
      ]),
      'merge'
    );
    const custom = result.sections.filter((s) => s.kind === 'custom');
    expect(custom.map((s) => [s.label, s.items.map((i) => i.title)])).toEqual([
      ['Volunteering', ['Food bank', 'Shelter']],
      ['Publications', ['A paper']],
    ]);
  });

  it('merge never mixes shapes: a custom list stays apart from a custom section of its name', () => {
    const withCustom: ResumeData = {
      ...current,
      sections: [...current.sections, section('custom', 'Languages', ['Spanish'])],
    };
    const result = buildImportedResume(
      withCustom,
      parsed([section('custom', 'Languages', ['English'], 'lines')]),
      'merge'
    );
    expect(
      result.sections.filter((s) => s.kind === 'custom').map((s) => [s.layout, s.items.length])
    ).toEqual([
      ['entries', 1],
      ['lines', 1],
    ]);
  });

  it('merge keeps the name and a header that prints anything', () => {
    const { contact: result } = buildImportedResume(
      current,
      parsed([section('skills', 'Skills', ['Go'])], contact('Not This', email('not@this.com'))),
      'merge'
    );
    expect(result).toEqual(current.contact);
    expect(keepsHeader(current.contact)).toBe(true);
  });

  it('merge takes the name and header only where the open resume has none', () => {
    const incoming = contact('Ada', email('ada@example.com'));
    // A header of items with no text prints nothing, so it is taken as having none.
    const blank = contact('', createHeaderItem('phone'), createHeaderItem('email'));
    const { contact: result } = buildImportedResume(
      { ...current, contact: blank },
      parsed([section('skills', 'Skills', ['Go'])], incoming),
      'merge'
    );
    expect(result).toEqual(incoming);
  });
});
