import {
  AlignLeft,
  GraduationCap,
  Briefcase,
  Building,
  FolderKanban,
  Wrench,
  Award,
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
};

export const SECTION_TYPE_OPTIONS: { type: SectionType; label: string }[] = [
  { type: 'summary', label: 'Summary' },
  { type: 'education', label: 'Education' },
  { type: 'experience', label: 'Experience' },
  { type: 'internships', label: 'Internships' },
  { type: 'projects', label: 'Projects' },
  { type: 'skills', label: 'Skills' },
  { type: 'certifications', label: 'Certifications' },
];
