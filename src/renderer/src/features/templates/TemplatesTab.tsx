import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { Text } from '@/components/Text';
import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useIsTourShowingOpenHistory } from '@/features/onboarding/useIsTourShowingOpenHistory';
import { tourTargetProps } from '@/features/onboarding/tourSteps';
import { NoTemplates } from './NoTemplates';
import { TemplateCard } from './TemplateCard';

export function TemplatesTab() {
  const templates = useTemplateStore((s) => s.templates);
  const activeId = useResumeStore((s) => s.templateId);
  const openSurface = useOverlayStore((s) => s.openSurface);
  const [query, setQuery] = useState('');
  // Cards the user opened or closed; the open template's history shows until closed.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isTourShowingOpenHistory = useIsTourShowingOpenHistory();

  if (templates.length === 0) return <NoTemplates />;

  const needle = query.trim().toLowerCase();
  const shown = templates.filter((t) => t.name.toLowerCase().includes(needle));
  const isExpanded = (id: string) =>
    (isTourShowingOpenHistory && id === activeId) || (toggled[id] ?? id === activeId);

  return (
    <div {...tourTargetProps('templates')}>
      <div className="mb-2 flex gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
          <AppInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a template…"
            aria-label="Find a template"
            className="pl-8"
          />
        </div>
        <AppButton
          variant="outline"
          size="sm"
          title="Start a new resume as its own template"
          onClick={() => openSurface({ kind: 'start' })}
        >
          <Plus />
          New
        </AppButton>
      </div>
      <Text as="p" variant="secondary" className="mb-2.5 ml-0.5">
        A template holds your content and its history. Your draft saves as you type. Name a version
        when you want to find it again.
      </Text>

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
          <Text as="p" variant="secondary" className="px-1 py-4 text-center text-ink-faint">
            No template is named like “{query.trim()}”.
          </Text>
        )}
      </div>
    </div>
  );
}
