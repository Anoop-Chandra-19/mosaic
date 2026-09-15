import {
  AlignLeft,
  GraduationCap,
  Briefcase,
  Building,
  FolderKanban,
  Wrench,
  Award,
  LayoutList,
  type LucideIcon,
} from 'lucide-react';
import type { SectionType } from '@/types/resume';

export const SECTION_ICONS: Record<SectionType, LucideIcon> = {
  summary: AlignLeft,
  education: GraduationCap,
  experience: Briefcase,
  internships: Building,
  projects: FolderKanban,
  skills: Wrench,
  certifications: Award,
  custom: LayoutList,
};

/** The built-in sections: a resume has at most one of each. */
export const SECTION_TYPE_OPTIONS: { type: SectionType; label: string }[] = [
  { type: 'summary', label: 'Summary' },
  { type: 'education', label: 'Education' },
  { type: 'experience', label: 'Experience' },
  { type: 'internships', label: 'Internships' },
  { type: 'projects', label: 'Projects' },
  { type: 'skills', label: 'Skills' },
  { type: 'certifications', label: 'Certifications' },
];

/** A custom section's name until the user gives it one — its name opens for editing. */
export const NEW_CUSTOM_SECTION_LABEL = 'New section';
