export type SectionType =
  | 'summary'
  | 'education'
  | 'experience'
  | 'internships'
  | 'projects'
  | 'skills'
  | 'certifications';

export interface Bullet {
  id: string;
  text: string;
  selected: boolean;
}

export interface ResumeEntry {
  id: string;
  selected: boolean;
  bullets: Bullet[];
  title?: string;
  subtitle?: string;
  text?: string;
  startDate?: string;
  endDate?: string;
  meta?: Record<string, string>;
}

export interface ResumeSection {
  id: string;
  type: SectionType;
  label: string;
  items: ResumeEntry[];
  order: number;
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  /** Work authorization, e.g. "US Citizen" or "F-1 STEM OPT, work authorized
   *  through July 2028". Renders on the header's third line as
   *  "<status> | <location>". Optional: leave it empty and the line falls back
   *  to the location alone. */
  citizenshipStatus?: string;
  linkedin: string;
  github: string;
  website: string;
  showLinkedin?: boolean;
  showGithub?: boolean;
  showWebsite?: boolean;
}

export interface ResumeData {
  schemaVersion: number;
  contact: ContactInfo;
  sections: ResumeSection[];
}

export interface PendingTextAiChange {
  id: string;
  createdAt: string;
  target:
    | { kind: 'entry-text'; sectionId: string; entryId: string }
    | { kind: 'bullet-text'; sectionId: string; entryId: string; bulletId: string };
  before: string;
  after: string;
  reason?: string;
}

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  model: string;
  keyStorageMode: 'session' | 'keychain';
}
