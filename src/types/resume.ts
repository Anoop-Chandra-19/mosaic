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
  linkedin: string;
  github: string;
  website: string;
  showLinkedin?: boolean;
  showGithub?: boolean;
  showWebsite?: boolean;
}

export interface ResumeData {
  contact: ContactInfo;
  sections: ResumeSection[];
}

export interface Template {
  id: string;
  name: string;
  snapshot: ResumeData;
  createdAt: string;
  updatedAt: string;
}

export type AIProvider = 'openai' | 'gemini' | 'ollama';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  model: string;
  openaiKey: string | null;
  geminiKey: string | null;
}
