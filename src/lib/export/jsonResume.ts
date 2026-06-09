import type { ExportEntry, NormalizedResumeExport } from '@/lib/export/normalizeResumeExport';

/**
 * Minimal subset of the JSON Resume schema (jsonresume.org, v1.0.0). Every
 * field is optional in the upstream schema, so a conservative mapping is
 * always valid. Mosaic-specific structure (selection flags, freeform
 * subtitles) maps losslessly where possible and is never parsed
 * heuristically — a subtitle lands whole in the closest matching field.
 */
interface JsonResumeProfile {
  network: string;
  url: string;
}

interface JsonResumeBasics {
  name?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: { address?: string };
  profiles?: JsonResumeProfile[];
}

interface JsonResumeWork {
  name?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
}

interface JsonResumeEducation {
  institution?: string;
  area?: string;
  startDate?: string;
  endDate?: string;
  courses?: string[];
}

interface JsonResumeProject {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  highlights?: string[];
}

interface JsonResumeSkill {
  name?: string;
}

interface JsonResumeCertificate {
  name?: string;
  issuer?: string;
  date?: string;
}

interface JsonResume {
  $schema: string;
  basics?: JsonResumeBasics;
  work?: JsonResumeWork[];
  education?: JsonResumeEducation[];
  projects?: JsonResumeProject[];
  skills?: JsonResumeSkill[];
  certificates?: JsonResumeCertificate[];
}

/** Strip empty strings, undefined values, and empty arrays from an object. */
function compact<T extends object>(value: T): T {
  const result = {} as T;
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === '') continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    result[key as keyof T] = entry as T[keyof T];
  }
  return result;
}

function toWork(entry: ExportEntry): JsonResumeWork {
  return compact({
    name: entry.subtitle,
    position: entry.title,
    startDate: entry.startDate,
    endDate: entry.endDate,
    highlights: entry.bullets,
  });
}

function buildBasics(data: NormalizedResumeExport): JsonResumeBasics {
  const { contact } = data;

  const profiles: JsonResumeProfile[] = [];
  if (contact.linkedin) profiles.push({ network: 'LinkedIn', url: contact.linkedin });
  if (contact.github) profiles.push({ network: 'GitHub', url: contact.github });

  const summary = data.sections
    .filter((section) => section.type === 'summary')
    .flatMap((section) => section.entries.map((entry) => entry.text))
    .filter(Boolean)
    .join('\n\n');

  return compact({
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    url: contact.website,
    summary,
    // Mosaic's location is freeform; JSON Resume's is structured. The whole
    // string goes to `address` rather than guessing at city/region splits.
    location: contact.location ? { address: contact.location } : undefined,
    profiles,
  });
}

export function createJsonResumeExport(data: NormalizedResumeExport): string {
  const work: JsonResumeWork[] = [];
  const education: JsonResumeEducation[] = [];
  const projects: JsonResumeProject[] = [];
  const skills: JsonResumeSkill[] = [];
  const certificates: JsonResumeCertificate[] = [];

  for (const section of data.sections) {
    for (const entry of section.entries) {
      switch (section.type) {
        case 'experience':
        case 'internships':
          work.push(toWork(entry));
          break;
        case 'education':
          education.push(
            compact({
              institution: entry.subtitle,
              area: entry.title,
              startDate: entry.startDate,
              endDate: entry.endDate,
              courses: entry.bullets,
            })
          );
          break;
        case 'projects':
          projects.push(
            compact({
              name: entry.title,
              description: entry.subtitle,
              startDate: entry.startDate,
              endDate: entry.endDate,
              highlights: entry.bullets,
            })
          );
          break;
        case 'skills':
          if (entry.text) skills.push({ name: entry.text });
          break;
        case 'certifications':
          certificates.push(
            compact({
              name: entry.title,
              issuer: entry.subtitle,
              date: entry.endDate ?? entry.startDate,
            })
          );
          break;
        case 'summary':
          // Folded into basics.summary by buildBasics.
          break;
      }
    }
  }

  const resume: JsonResume = compact({
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: buildBasics(data),
    work,
    education,
    projects,
    skills,
    certificates,
  });

  return JSON.stringify(resume, null, 2);
}
