import type { LucideIcon } from 'lucide-react';
import { Bot, Info, Shield, SlidersHorizontal } from 'lucide-react';

export type SettingsSectionId = 'app' | 'ai' | 'privacy' | 'about';

export type SettingsGroupId = 'workspace' | 'intelligence' | 'safety' | 'meta';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  group: SettingsGroupId;
  icon: LucideIcon;
}

export const SETTINGS_GROUP_LABELS: Record<SettingsGroupId, string> = {
  workspace: 'Workspace',
  intelligence: 'AI',
  safety: 'Privacy',
  meta: 'Meta',
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'app',
    label: 'App Preferences',
    description: 'Appearance and preview defaults',
    group: 'workspace',
    icon: SlidersHorizontal,
  },
  {
    id: 'ai',
    label: 'AI Providers',
    description: 'Provider, model, and key handling',
    group: 'intelligence',
    icon: Bot,
  },
  {
    id: 'privacy',
    label: 'Privacy and Data',
    description: 'Clear and reset local data',
    group: 'safety',
    icon: Shield,
  },
  {
    id: 'about',
    label: 'About Mosaic',
    description: 'Version and project context',
    group: 'meta',
    icon: Info,
  },
];

export const SETTINGS_SECTION_BY_ID = SETTINGS_SECTIONS.reduce(
  (acc, section) => ({ ...acc, [section.id]: section }),
  {} as Record<SettingsSectionId, SettingsSection>
);
