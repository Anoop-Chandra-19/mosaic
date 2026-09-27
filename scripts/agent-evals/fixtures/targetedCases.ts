/**
 * Instructions that name the words to change, each with the one right result. Fictional
 * bullets only. `neighbour` cases need a word next to the swap changed too, or the
 * sentence breaks.
 */
export interface TargetedCase {
  kind: 'swap' | 'neighbour' | 'value' | 'remove' | 'everywhere';
  instruction: string;
  bullets: string[];
  expected: string[];
}

export const TARGETED_CASES: TargetedCase[] = [
  {
    kind: 'swap',
    instruction: 'Swap "Led" for "Drove".',
    bullets: [
      'Led migration of 14 services from a monolith to containers, cutting deploy time from 40 minutes to 6',
    ],
    expected: [
      'Drove migration of 14 services from a monolith to containers, cutting deploy time from 40 minutes to 6',
    ],
  },
  {
    kind: 'swap',
    instruction: 'Change "Managed" to "Led".',
    bullets: [
      'Managed a team of 5 engineers building the route planning feature for a regional courier',
    ],
    expected: [
      'Led a team of 5 engineers building the route planning feature for a regional courier',
    ],
  },
  {
    kind: 'swap',
    instruction: 'Swap "Mentored" for "Coached".',
    bullets: [
      'Mentored two junior developers through their first year, pairing weekly on code reviews',
    ],
    expected: [
      'Coached two junior developers through their first year, pairing weekly on code reviews',
    ],
  },
  {
    kind: 'swap',
    instruction: 'Swap "Handled" for "Led".',
    bullets: [
      'Handled the transition of the reporting stack from nightly batch jobs to streaming updates',
    ],
    expected: [
      'Led the transition of the reporting stack from nightly batch jobs to streaming updates',
    ],
  },
  {
    kind: 'swap',
    instruction: 'Swap "Cut" for "Reduced".',
    bullets: [
      'Cut cloud spend by rightsizing database instances and removing unused storage buckets',
    ],
    expected: [
      'Reduced cloud spend by rightsizing database instances and removing unused storage buckets',
    ],
  },
  {
    kind: 'swap',
    instruction: 'Say "product pages" instead of "catalog pages".',
    bullets: [
      'Improved page load performance on the catalog pages by lazy loading images and trimming scripts',
    ],
    expected: [
      'Improved page load performance on the product pages by lazy loading images and trimming scripts',
    ],
  },
  {
    kind: 'swap',
    instruction: 'Change "city transit authority" to "regional rail operator".',
    bullets: [
      'Was part of the team that rewrote the ticketing system for a city transit authority',
    ],
    expected: [
      'Was part of the team that rewrote the ticketing system for a regional rail operator',
    ],
  },
  {
    kind: 'swap',
    instruction: 'Swap "productionize" for "ship".',
    bullets: ['Collaborated with the data science team to productionize a fraud scoring model'],
    expected: ['Collaborated with the data science team to ship a fraud scoring model'],
  },
  {
    kind: 'swap',
    instruction: 'Change "Terraform" to "OpenTofu".',
    bullets: ['Maintained the Terraform modules for staging and production environments'],
    expected: ['Maintained the OpenTofu modules for staging and production environments'],
  },
  {
    kind: 'neighbour',
    instruction: 'Swap "Assisted" for "Led".',
    bullets: [
      'Assisted in the planning and execution of the annual accessibility audit of the web app',
    ],
    expected: ['Led the planning and execution of the annual accessibility audit of the web app'],
  },
  {
    kind: 'neighbour',
    instruction: 'Swap "Helped" for "Reduced".',
    bullets: [
      'Helped reduce customer support tickets by improving error messages across the checkout page',
    ],
    expected: [
      'Reduced customer support tickets by improving error messages across the checkout page',
    ],
  },
  {
    kind: 'neighbour',
    instruction: 'Change "Responsible for" to "Maintained".',
    bullets: [
      'Responsible for maintaining the internal billing dashboard used by the finance team every day',
    ],
    expected: ['Maintained the internal billing dashboard used by the finance team every day'],
  },
  {
    kind: 'neighbour',
    instruction: 'Replace "Participated in hiring" with "Supported hiring".',
    bullets: ['Participated in hiring, conducting over 40 technical interviews for frontend roles'],
    expected: ['Supported hiring, conducting over 40 technical interviews for frontend roles'],
  },
  {
    kind: 'value',
    instruction: 'It was 45 components, not 60.',
    bullets: ['Created a design system of 60 components that was adopted by three product teams'],
    expected: ['Created a design system of 45 components that was adopted by three product teams'],
  },
  {
    kind: 'value',
    instruction: 'Make it every minute instead of every 5 minutes.',
    bullets: [
      'Built a data pipeline that ingests sensor readings from greenhouse controllers every 5 minutes',
    ],
    expected: [
      'Built a data pipeline that ingests sensor readings from greenhouse controllers every minute',
    ],
  },
  {
    kind: 'value',
    instruction: 'It went down to 4%, not 3%.',
    bullets: [
      'Took ownership of flaky test cleanup, bringing the CI failure rate down from 18% to 3%',
    ],
    expected: [
      'Took ownership of flaky test cleanup, bringing the CI failure rate down from 18% to 4%',
    ],
  },
  {
    kind: 'remove',
    instruction: 'Remove "closely".',
    bullets: [
      'Worked closely with customers to gather feedback and translate it into feature requests',
    ],
    expected: ['Worked with customers to gather feedback and translate it into feature requests'],
  },
  {
    kind: 'remove',
    instruction: 'Remove "documentation and".',
    bullets: [
      'Wrote documentation and runbooks for the payments service that new hires used during onboarding',
    ],
    expected: ['Wrote runbooks for the payments service that new hires used during onboarding'],
  },
  {
    kind: 'everywhere',
    instruction: 'Say "PostgreSQL" instead of "Postgres" everywhere.',
    bullets: [
      'Moved reporting from Postgres to a streaming setup',
      'Tuned Postgres queries for the invoicing service',
      'Wrote the on-call guide for the Postgres cluster',
    ],
    expected: [
      'Moved reporting from PostgreSQL to a streaming setup',
      'Tuned PostgreSQL queries for the invoicing service',
      'Wrote the on-call guide for the PostgreSQL cluster',
    ],
  },
  {
    kind: 'everywhere',
    instruction: 'Change "k8s" to "Kubernetes" everywhere.',
    bullets: [
      'Built the k8s deployment pipeline for the API',
      'Ran k8s upgrades for staging and production',
      'Wrote alerts for the payments service',
    ],
    expected: [
      'Built the Kubernetes deployment pipeline for the API',
      'Ran Kubernetes upgrades for staging and production',
      'Wrote alerts for the payments service',
    ],
  },
];
