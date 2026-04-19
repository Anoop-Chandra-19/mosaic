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
  schemaVersion: number;
  contact: ContactInfo;
  sections: ResumeSection[];
}

export interface TemplateRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  headVersionId: string;
}

export type TemplateVersionSource = 'save-new' | 'update' | 'restore' | 'import-save' | 'ai-batch';

export interface TemplateVersion {
  id: string;
  templateId: string;
  parentVersionId: string | null;
  createdAt: string;
  message: string;
  source: TemplateVersionSource;
  snapshot: ResumeData;
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

export type RollbackReason = 'before-import' | 'before-restore';

export interface LocalCheckpoint {
  createdAt: string;
  reason: RollbackReason;
  snapshot: ResumeData;
}

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  model: string;
  keyStorageMode: 'session' | 'keychain';
}
