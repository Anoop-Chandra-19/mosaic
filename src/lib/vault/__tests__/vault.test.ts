import { describe, expect, it } from 'vitest';
import { buildVault, serializeVault } from '../exportVault';
import { parseVault } from '../parseVault';
import type { PersistedTemplateState } from '@/types/vault';
import type { ResumeData } from '@/types/resume';

function createResume(schemaVersion = 1): ResumeData {
  return {
    schemaVersion,
    contact: {
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '555-0100',
      location: 'Detroit, MI',
      linkedin: 'linkedin.com/in/alex',
      github: '',
      website: '',
    },
    sections: [
      {
        id: 'sec-experience',
        type: 'experience',
        label: 'Experience',
        order: 0,
        items: [
          {
            id: 'job-1',
            selected: true,
            title: 'Engineer',
            subtitle: 'Mosaic',
            bullets: [{ id: 'b1', text: 'Built export flow', selected: true }],
          },
        ],
      },
    ],
  };
}

function createTemplates(snapshotSchemaVersion = 1): PersistedTemplateState {
  return {
    templates: [
      {
        id: 'tmpl-1',
        name: 'Default',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        headVersionId: 'v1',
      },
    ],
    versionsByTemplateId: {
      'tmpl-1': [
        {
          id: 'v1',
          templateId: 'tmpl-1',
          parentVersionId: null,
          createdAt: '2026-06-01T00:00:00.000Z',
          message: 'Initial save',
          source: 'save-new',
          snapshot: createResume(snapshotSchemaVersion),
        },
      ],
    },
    activeTemplateId: 'tmpl-1',
    activeVersionId: 'v1',
  };
}

const FIXED_DATE = new Date('2026-06-09T12:00:00.000Z');

describe('vault round-trip', () => {
  it('parses its own serialized output back to an equal vault', () => {
    const vault = buildVault(createResume(), createTemplates(), FIXED_DATE);
    const result = parseVault(serializeVault(vault));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.vault).toEqual(vault);
  });

  it('writes exactly the four envelope keys, pretty-printed', () => {
    const serialized = serializeVault(buildVault(createResume(), createTemplates(), FIXED_DATE));
    const raw = JSON.parse(serialized) as Record<string, unknown>;

    expect(Object.keys(raw).sort()).toEqual(['exportedAt', 'resume', 'templates', 'vaultVersion']);
    expect(raw.exportedAt).toBe('2026-06-09T12:00:00.000Z');
    expect(serialized).toContain('\n  ');
  });
});

describe('parseVault rejections', () => {
  const validVaultJson = () =>
    serializeVault(buildVault(createResume(), createTemplates(), FIXED_DATE));

  it('rejects malformed JSON', () => {
    expect(parseVault('{')).toEqual({ ok: false, code: 'invalid-json' });
  });

  it('rejects JSON that is not a vault envelope', () => {
    expect(parseVault('[]')).toMatchObject({ ok: false, code: 'not-a-vault' });
    expect(parseVault('"text"')).toMatchObject({ ok: false, code: 'not-a-vault' });
    expect(parseVault('{"resume": {}}')).toMatchObject({ ok: false, code: 'not-a-vault' });
  });

  it('rejects a foreign JSON Resume document', () => {
    const jsonResume = JSON.stringify({ basics: { name: 'Alex' }, work: [] });
    expect(parseVault(jsonResume)).toMatchObject({ ok: false, code: 'not-a-vault' });
  });

  it('rejects newer vault versions explicitly', () => {
    const raw = JSON.parse(validVaultJson());
    raw.vaultVersion = 2;
    expect(parseVault(JSON.stringify(raw))).toMatchObject({
      ok: false,
      code: 'unsupported-version',
    });
  });

  it('rejects a resume with an unknown section type', () => {
    const raw = JSON.parse(validVaultJson());
    raw.resume.sections[0].type = 'hobbies';
    expect(parseVault(JSON.stringify(raw))).toMatchObject({ ok: false, code: 'invalid-resume' });
  });

  it('rejects a resume with non-array sections', () => {
    const raw = JSON.parse(validVaultJson());
    raw.resume.sections = 'oops';
    expect(parseVault(JSON.stringify(raw))).toMatchObject({ ok: false, code: 'invalid-resume' });
  });

  it('rejects a template whose head version is missing', () => {
    const raw = JSON.parse(validVaultJson());
    raw.templates.templates[0].headVersionId = 'gone';
    expect(parseVault(JSON.stringify(raw))).toMatchObject({
      ok: false,
      code: 'invalid-templates',
    });
  });

  it('rejects resume schema versions newer than this build', () => {
    const raw = JSON.parse(validVaultJson());
    raw.resume.schemaVersion = 99;
    expect(parseVault(JSON.stringify(raw))).toMatchObject({
      ok: false,
      code: 'unsupported-version',
    });
  });

  it('rejects snapshot schema versions newer than this build', () => {
    const raw = JSON.parse(validVaultJson());
    raw.templates.versionsByTemplateId['tmpl-1'][0].snapshot.schemaVersion = 99;
    expect(parseVault(JSON.stringify(raw))).toMatchObject({
      ok: false,
      code: 'unsupported-version',
    });
  });
});

describe('parseVault migration and repair', () => {
  it('migrates old schema versions in resume and snapshots', () => {
    const vault = buildVault(createResume(0), createTemplates(0), FIXED_DATE);
    const result = parseVault(serializeVault(vault));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vault.resume.schemaVersion).toBe(1);
      expect(result.vault.templates.versionsByTemplateId['tmpl-1'][0].snapshot.schemaVersion).toBe(
        1
      );
    }
  });

  it('repairs a dangling activeTemplateId instead of rejecting', () => {
    const templates = createTemplates();
    templates.activeTemplateId = 'gone';
    const result = parseVault(serializeVault(buildVault(createResume(), templates, FIXED_DATE)));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vault.templates.activeTemplateId).toBeNull();
      expect(result.vault.templates.activeVersionId).toBeNull();
    }
  });
});
