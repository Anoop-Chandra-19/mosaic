import { CURRENT_SCHEMA_VERSION } from '@shared/resume/migrateResume';
import type { Bullet, HeaderItem, ResumeData, ResumeEntry } from '@shared/types/resume';

/** A fictional person, so development and tests never hold a real resume. */
export const EXAMPLE_TEMPLATE_NAME = 'Rowan Vale (example)';

/** The ids the example suggestions are staged against. */
export const EXAMPLE_IDS = {
  experience: 'ex-experience',
  harbor: 'ex-harbor',
  lantern: 'ex-lantern',
} as const;

const bullet = (id: string, text: string): Bullet => ({ id, text, selected: true });

const headerItem = (id: string, kind: HeaderItem['kind'], text: string, url = ''): HeaderItem => ({
  id,
  kind,
  text,
  url,
  shown: true,
});

const line = (id: string, text: string): ResumeEntry => ({
  id,
  selected: true,
  bullets: [],
  text,
});

/** A fresh copy each time, since the editor takes ownership of what it opens. */
export function createExampleResume(): ResumeData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: {
      name: 'Rowan Vale',
      header: {
        linkStyle: 'plain',
        lines: [
          {
            id: 'ex-head',
            separator: ' | ',
            align: 'center',
            items: [
              headerItem('ex-email', 'email', 'rowan.vale@example.com', 'rowan.vale@example.com'),
              headerItem('ex-phone', 'phone', '(503) 555-0172', '(503) 555-0172'),
              headerItem('ex-location', 'location', 'Portland, OR'),
            ],
          },
        ],
      },
    },
    sections: [
      {
        id: 'ex-summary',
        kind: 'summary',
        layout: 'lines',
        label: 'Summary',
        order: 0,
        items: [
          line(
            'ex-summary-1',
            'Backend engineer with six years on billing, payments and mapping services.'
          ),
        ],
      },
      {
        id: EXAMPLE_IDS.experience,
        kind: 'experience',
        layout: 'entries',
        label: 'Experience',
        order: 1,
        items: [
          {
            id: EXAMPLE_IDS.harbor,
            selected: true,
            title: 'Backend Engineer',
            organization: 'Harbor Freight Labs',
            location: 'Portland, OR',
            dates: 'Mar 2022 – Present',
            bullets: [
              bullet('ex-b1', 'Assisted in migrating billing to Postgres'),
              bullet('ex-b2', 'Reduced p99 latency from 18% to 3% of requests'),
              bullet('ex-b3', 'Wrote the on-call runbook for the payments team'),
              bullet('ex-b4', 'Organized the team book club'),
            ],
          },
          {
            id: EXAMPLE_IDS.lantern,
            selected: true,
            title: 'Software Engineer',
            organization: 'Lantern Geo',
            location: 'Remote',
            dates: 'Jun 2019 – Feb 2022',
            bullets: [
              bullet('ex-b5', 'Built tile caching for the Oslo office'),
              bullet(
                'ex-b6',
                'Moved tile rendering to AWS across 3 regions. Wrote the capacity plan for the move.'
              ),
              bullet('ex-b7', 'Trained four new on-call engineers'),
              bullet('ex-b8', 'Wrote the on-call guide for routing'),
              bullet('ex-b9', 'Cut deploy time for the routing service'),
            ],
          },
        ],
      },
      {
        id: 'ex-education',
        kind: 'education',
        layout: 'entries',
        label: 'Education',
        order: 2,
        items: [
          {
            id: 'ex-psu',
            selected: true,
            title: 'B.S. Computer Science',
            organization: 'Portland State University',
            dates: '2019',
            bullets: [],
          },
        ],
      },
      {
        id: 'ex-skills',
        kind: 'skills',
        layout: 'lines',
        label: 'Skills',
        order: 3,
        items: [line('ex-skills-1', 'Go, Python, SQL, PostgreSQL, Redis, AWS, Terraform')],
      },
    ],
  };
}
