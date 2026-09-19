import { CURRENT_SCHEMA_VERSION } from './migrateResume';
import type { HeaderItem, HeaderItemKind, ResumeData } from '../types/resume';

function item(id: string, kind: HeaderItemKind, text: string, url = ''): HeaderItem {
  return { id, kind, text, url, shown: true };
}

/**
 * The example resume: offered by the empty state as "Start from the example", and what
 * the editor falls back to on reset.
 */
export const DEFAULT_RESUME: ResumeData = {
  schemaVersion: 1,
  // The Headless header: how to reach you on one line, where you can work on the next.
  contact: {
    name: 'Your Name',
    header: {
      linkStyle: 'plain',
      lines: [
        {
          id: 'head-reach',
          separator: ' | ',
          align: 'center',
          items: [
            item('head-phone', 'phone', '(555) 010-0100', '(555) 010-0100'),
            item('head-email', 'email', 'you@example.com', 'you@example.com'),
            item('head-linkedin', 'linkedin', 'LinkedIn', 'linkedin.com/in/you'),
          ],
        },
        {
          id: 'head-status',
          separator: ' | ',
          align: 'center',
          items: [
            item('head-auth', 'auth', 'US Citizen'),
            item('head-location', 'location', 'City, State'),
          ],
        },
      ],
    },
  },
  // Sections follow the Headless format: Education above Work History, no
  // Summary or Skills block. Bullets show the shape the format asks for --
  // a keyword, how it was used, then the result or reason.
  sections: [
    {
      id: 'sec-education',
      kind: 'education',
      layout: 'entries',
      label: 'Education & Certificates',
      order: 0,
      items: [
        {
          id: 'edu1',
          selected: true,
          title: 'M.S. in Your Field',
          organization: 'Your University',
          location: 'City, State',
          dates: '2025',
          bullets: [],
        },
        {
          id: 'edu2',
          selected: true,
          title: 'B.S. in Your Field',
          organization: 'Your University',
          location: 'City, State',
          dates: 'Status - Graduated',
          bullets: [],
        },
      ],
    },
    {
      id: 'sec-experience',
      kind: 'experience',
      layout: 'entries',
      label: 'Work History',
      order: 1,
      items: [
        {
          id: 'job1',
          selected: true,
          title: 'Job Title',
          organization: 'Company',
          location: 'Location',
          dates: 'Month Year to Current',
          bullets: [
            {
              id: 'j1b1',
              selected: true,
              text: 'Worked in Agile sprints building and supporting the website, phone app, and AI features at a company that serves more than 10,000 customers.',
            },
            {
              id: 'j1b2',
              selected: true,
              text: 'Wrote the main product screens in TypeScript, JavaScript, HTML, CSS, and React, so customers could finish a task on screen instead of filing paperwork.',
            },
            {
              id: 'j1b3',
              selected: true,
              text: 'Built REST APIs in Node.js and NestJS over a PostgreSQL database, letting people save an unfinished form and come back to it later.',
            },
            {
              id: 'j1b4',
              selected: true,
              text: 'Wrote an AI agent in Python on a cloud platform with an agentic orchestrator over a hosted model, so a customer gets advice tailored to their own numbers.',
            },
            {
              id: 'j1b5',
              selected: true,
              text: 'Tested three machine learning methods for sorting customer conversations into topics, scored each one with SQL, and showed a cross functional group of leads which one to build on.',
            },
            {
              id: 'j1b6',
              selected: true,
              text: 'Handled DevOps deployments to QA and production using Docker images, Helm charts, and Git based CI/CD pipelines on Kubernetes, so every release went out the same way.',
            },
          ],
        },
      ],
    },
    {
      id: 'sec-projects',
      kind: 'projects',
      layout: 'entries',
      label: 'Projects',
      order: 2,
      items: [
        {
          id: 'proj1',
          selected: true,
          title: 'First Project',
          bullets: [
            {
              id: 'p1b1',
              selected: true,
              text: 'Say in one plain sentence what the project does and who it is for.',
            },
            {
              id: 'p1b2',
              selected: true,
              text: 'Trained a machine learning model in PyTorch using NumPy and pandas to sort inputs into categories at about 77 percent accuracy, so a user gets an answer instead of sorting by hand.',
            },
            {
              id: 'p1b3',
              selected: true,
              text: 'Served the trained model from a Docker container on AWS behind a small web page, so anyone could try it in a browser instead of installing anything.',
            },
          ],
        },
        {
          id: 'proj2',
          selected: true,
          title: 'Second Project',
          bullets: [
            {
              id: 'p2b1',
              selected: true,
              text: 'Built a tool that lets a person write, lay out, and print a document of their own.',
            },
            {
              id: 'p2b2',
              selected: true,
              text: 'Wrote it in TypeScript so everything stays inside the browser, meaning the data never leaves the browser it was written in.',
            },
            {
              id: 'p2b3',
              selected: true,
              text: 'Published it on GitHub with export to PDF and plain text, so a finished document can be sent anywhere.',
            },
          ],
        },
      ],
    },
  ],
};

export function createDefaultResume(): ResumeData {
  return structuredClone(DEFAULT_RESUME);
}

/** Nothing at all: what the editor holds while no template is open. */
export function createEmptyResume(): ResumeData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: { name: '', header: { linkStyle: 'plain', lines: [] } },
    sections: [],
  };
}
