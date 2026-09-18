import {
  AlignLeft,
  GraduationCap,
  Briefcase,
  Building,
  FolderKanban,
  Wrench,
  Award,
  LayoutList,
  List,
  type LucideIcon,
} from 'lucide-react';
import type { BuiltInSectionKind, SectionLayout } from '@shared/types/resume';

export const PRESET_ICONS: Record<BuiltInSectionKind, LucideIcon> = {
  summary: AlignLeft,
  education: GraduationCap,
  experience: Briefcase,
  internships: Building,
  projects: FolderKanban,
  skills: Wrench,
  certifications: Award,
};

/** A custom section has no kind to go by, so its icon shows its shape. */
export const CUSTOM_ICONS: Record<SectionLayout, LucideIcon> = {
  entries: LayoutList,
  lines: List,
};
