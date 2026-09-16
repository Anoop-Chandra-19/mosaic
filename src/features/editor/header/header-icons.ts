import {
  BadgeCheck,
  Github,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { HeaderItemKind } from '@/types/resume';

export const HEADER_ICONS: Record<HeaderItemKind, LucideIcon> = {
  phone: Phone,
  email: Mail,
  linkedin: Linkedin,
  github: Github,
  site: Globe,
  location: MapPin,
  auth: BadgeCheck,
  custom: Type,
};
