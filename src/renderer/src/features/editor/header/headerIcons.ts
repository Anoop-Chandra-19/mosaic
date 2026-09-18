import {
  BadgeCheck,
  BriefcaseBusiness,
  CodeXml,
  Globe,
  Mail,
  MapPin,
  Phone,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { HeaderItemKind } from '@shared/types/resume';

export const HEADER_ICONS: Record<HeaderItemKind, LucideIcon> = {
  phone: Phone,
  email: Mail,
  linkedin: BriefcaseBusiness,
  github: CodeXml,
  site: Globe,
  location: MapPin,
  auth: BadgeCheck,
  custom: Type,
};
