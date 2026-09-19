import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Input } from '@/components/ui/input';
import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { NoTemplates } from './NoTemplates';
import { TemplateCard } from './TemplateCard';

export function TemplatesTab() {
  const templates = useTemplateStore((s) => s.templates);
  const activeId = useResumeStore((s) => s.templateId);
  const setStartOpen = useOverlayStore((s) => s.setStartOpen);
  const [query, setQuery] = useState('');
  // Cards the user opened or closed; the open template's history shows until closed.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  if (templates.length === 0) return <NoTemplates />;

  const needle = query.trim().toLowerCase();
  const shown = templates.filter((t) => t.name.toLowerCase().includes(needle));
  const isExpanded = (id: string) => toggled[id] ?? id === activeId;

  return (
    <div>
      <div className="mb-2 flex gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a template…"
            aria-label="Find a template"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <AppButton
          variant="outline"
          size="sm"
          className="h-8"
          title="Start a new resume as its own template"
          onClick={() => setStartOpen(true)}
        >
          <Plus />
          New
        </AppButton>
      </div>
      <p className="mb-2.5 ml-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        A template holds your content and its history. Your draft saves as you type. Name a version
        when you want to find it again.
      </p>

      <div className="space-y-2">
        {shown.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            active={template.id === activeId}
            expanded={isExpanded(template.id)}
            onToggle={() =>
              setToggled((current) => ({ ...current, [template.id]: !isExpanded(template.id) }))
            }
          />
        ))}
        {shown.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-zinc-500">
            No template is named like “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}
