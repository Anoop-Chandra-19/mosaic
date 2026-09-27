/**
 * Fictional resumes for the page-break sweep, the same ones for the same seed: sections of
 * every layout, bullets of one to four lines, paragraphs, and entries with no bullets.
 */
import type { ResumeData, ResumeEntry, ResumeSection } from '../../src/shared/types/resume.ts';

export interface SweepResume {
  id: string;
  paper: 'a4' | 'letter';
  doc: ResumeData;
}

/** mulberry32: small, fast, and the same sequence for the same seed everywhere. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['Sam Rivera', 'Priya Natarajan', 'Jonas Okafor', 'Mei Lindqvist', 'Tomás Weber'];
const TITLES = [
  'Software Engineer',
  'Data Analyst',
  'Product Designer',
  'Site Reliability Engineer',
];
const ORGANIZATIONS = ['Harbor Transit Co', 'Northwind Freight', 'Lumen Health', 'Quarry Labs'];
const PLACES = ['Portland, OR', 'Leeds, UK', 'Remote', 'Toronto, ON', 'Austin, TX'];
const DEGREES = ['B.S. in Computer Science', 'M.A. in Economics', 'B.Eng. in Civil Engineering'];
const SCHOOLS = ['State University', 'Institute of Technology', 'City College'];
const CERTIFICATES = ['Cloud Practitioner', 'Scrum Master', 'Security Fundamentals'];
const VERBS = ['Built', 'Led', 'Rebuilt', 'Designed', 'Shipped', 'Cut', 'Moved', 'Wrote', 'Ran'];
const PHRASES = [
  'the fare reconciliation service',
  'a queue for nightly batch jobs',
  'reporting on late-running routes',
  'with operations and finance',
  'cutting processing time from six hours to forty minutes',
  'for a team of four engineers',
  'across 12 regional depots',
  'lifting on-time arrivals by 9% over two quarters',
  'with a written rollback plan for every step',
  'and a runbook the on-call rotation still uses',
  'to a managed cloud database',
  'which saved about $40,000 a year in licences',
  'covering "To the minute" arrival times',
  'while keeping the old API working for partners',
];
const SKILLS = ['TypeScript', 'Go', 'PostgreSQL', 'Kafka', 'Terraform', 'React', 'Python', 'SQL'];

export function generateSweepResumes(seed: number, count: number): SweepResume[] {
  const random = createRandom(seed);
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  let nextId = 0;
  const makeId = (prefix: string) => `${prefix}-${nextId++}`;

  const sentence = (words: number) => {
    const parts = [pick(VERBS)];
    while (parts.join(' ').split(' ').length < words) parts.push(pick(PHRASES));
    return `${parts.join(' ').split(' ').slice(0, words).join(' ')}.`;
  };
  // Mostly one or two lines, some three, a few four.
  const bulletLength = () => {
    const roll = random();
    return roll < 0.6 ? between(8, 20) : roll < 0.9 ? between(21, 35) : between(36, 55);
  };
  const entry = (fields: Partial<ResumeEntry>, bullets: string[]): ResumeEntry => ({
    id: makeId('entry'),
    selected: true,
    ...fields,
    bullets: bullets.map((text) => ({ id: makeId('bullet'), text, selected: true })),
  });
  const section = (
    kind: ResumeSection['kind'],
    layout: ResumeSection['layout'],
    label: string,
    items: ResumeEntry[]
  ): ResumeSection => ({ id: makeId('section'), kind, layout, label, items, order: 0 });
  const longLinksLine = (): ResumeData['contact']['header']['lines'][number] => {
    const handle = `${pick(['priya', 'jonas', 'mei', 'tomas', 'sam'])}-${pick(['natarajan', 'okafor', 'lindqvist', 'weber'])}-${between(10, 99)}`;
    const link = (kind: 'linkedin' | 'github' | 'site', text: string) => ({
      id: makeId('item'),
      kind,
      text,
      url: `https://${text}`,
      shown: true,
    });
    return {
      id: makeId('line'),
      separator: pick([' | ', ' · '] as const),
      align: 'center',
      items: [
        link('linkedin', `linkedin.com/in/${handle}`),
        link('github', `github.com/${handle}`),
        link('site', `${handle}.dev/portfolio`),
      ],
    };
  };
  const dates = () => `${pick(['Jan', 'Mar', 'Jun', 'Sep'])} ${between(2012, 2020)} to Present`;

  return Array.from({ length: count }, (_, index) => {
    const sections: ResumeSection[] = [];
    if (random() < 0.6) {
      sections.push(
        section('summary', 'lines', 'Summary', [entry({ text: sentence(between(25, 110)) }, [])])
      );
    }
    sections.push(
      section(
        'experience',
        'entries',
        'Experience',
        Array.from({ length: between(2, 5) }, () =>
          entry(
            {
              title: pick(TITLES),
              organization: pick(ORGANIZATIONS),
              location: pick(PLACES),
              dates: dates(),
            },
            Array.from({ length: between(2, 7) }, () => sentence(bulletLength()))
          )
        )
      )
    );
    if (random() < 0.7) {
      sections.push(
        section(
          'projects',
          'entries',
          'Projects',
          Array.from({ length: between(1, 4) }, () =>
            entry(
              { title: `${pick(VERBS)} ${pick(SKILLS)} tooling` },
              Array.from({ length: between(1, 3) }, () => sentence(bulletLength()))
            )
          )
        )
      );
    }
    sections.push(
      section(
        'education',
        'entries',
        'Education',
        Array.from({ length: between(1, 3) }, () =>
          entry(
            {
              title: pick(DEGREES),
              organization: pick(SCHOOLS),
              dates: String(between(2008, 2020)),
            },
            random() < 0.3 ? [sentence(between(6, 18))] : []
          )
        )
      )
    );
    if (random() < 0.8) {
      sections.push(
        section(
          'skills',
          'lines',
          'Skills',
          Array.from({ length: between(2, 6) }, () =>
            entry(
              {
                text: `${pick(['Languages', 'Tools', 'Data'])}: ${Array.from({ length: between(3, 20) }, () => pick(SKILLS)).join(', ')}`,
              },
              []
            )
          )
        )
      );
    }
    if (random() < 0.4) {
      sections.push(
        section(
          'certifications',
          'entries',
          'Certifications',
          Array.from({ length: between(1, 4) }, () =>
            entry({ title: pick(CERTIFICATES), dates: String(between(2015, 2025)) }, [])
          )
        )
      );
    }
    sections.forEach((s, order) => (s.order = order));

    const doc: ResumeData = {
      schemaVersion: 1,
      contact: {
        name: pick(NAMES),
        header: {
          linkStyle: 'plain',
          lines: [
            {
              id: makeId('line'),
              separator: ' | ',
              align: 'center',
              items: [
                {
                  id: makeId('item'),
                  kind: 'email',
                  text: 'name@example.com',
                  url: 'mailto:name@example.com',
                  shown: true,
                },
                { id: makeId('item'), kind: 'phone', text: '555-0100', url: '', shown: true },
                { id: makeId('item'), kind: 'location', text: pick(PLACES), url: '', shown: true },
              ],
            },
            // Links long enough to wrap onto a second line, as long profile addresses do.
            ...(random() < 0.35 ? [longLinksLine()] : []),
          ],
        },
      },
      sections,
    };
    return {
      id: `resume-${String(index).padStart(3, '0')}`,
      paper: index % 2 ? 'letter' : 'a4',
      doc,
    };
  });
}
