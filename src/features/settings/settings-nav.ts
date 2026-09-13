import type { LucideIcon } from 'lucide-react';
import { Contrast, Database, FileText, Info, Settings, Shield, Sparkles } from 'lucide-react';

export type SettingsSectionId =
  | 'general'
  | 'appearance'
  | 'document'
  | 'ai'
  | 'portability'
  | 'privacy'
  | 'about';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  /** The line under the section's heading. */
  description: string;
  icon: LucideIcon;
}

export interface SettingsGroup {
  /** No label for the group that holds About on its own. */
  label: string | null;
  sections: SettingsSection[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: 'Workspace',
    sections: [
      {
        id: 'general',
        label: 'General',
        description: 'How Mosaic behaves on this machine.',
        icon: Settings,
      },
      {
        id: 'appearance',
        label: 'Appearance',
        description: 'Chrome only — the resume page is always black on white.',
        icon: Contrast,
      },
      {
        id: 'document',
        label: 'Document',
        description: 'How the page is set up. Its metrics stay on the 18pt leading grid.',
        icon: FileText,
      },
    ],
  },
  {
    label: 'Intelligence',
    sections: [
      {
        id: 'ai',
        label: 'AI assistant',
        description: 'Optional, bring-your-own-key, and reviewable.',
        icon: Sparkles,
      },
    ],
  },
  {
    label: 'Your data',
    sections: [
      {
        id: 'portability',
        label: 'Import & export',
        description:
          'Your content is yours. Everything here works offline, and nothing is locked to Mosaic.',
        icon: Database,
      },
      {
        id: 'privacy',
        label: 'Privacy',
        description: 'Mosaic has no account, no telemetry, and no server.',
        icon: Shield,
      },
    ],
  },
  {
    label: null,
    sections: [
      {
        id: 'about',
        label: 'About',
        description: 'Local-first resume builder.',
        icon: Info,
      },
    ],
  },
];

export const SETTINGS_SECTION_BY_ID = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((group) => group.sections).map((section) => [section.id, section])
) as Record<SettingsSectionId, SettingsSection>;
