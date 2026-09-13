import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { attempt, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { NoTemplates } from './NoTemplates';
import { TemplateCard } from './TemplateCard';

export function TemplatesTab() {
  const templates = useTemplateStore((s) => s.templates);
  const openTemplate = useTemplateStore((s) => s.openTemplate);
  const activeTemplateId = useResumeStore((s) => s.templateId);
  const setStartOpen = useOverlayStore((s) => s.setStartOpen);
  const setActiveSidebarTab = useUIStore((s) => s.setActiveSidebarTab);

  // Every template's draft is saved as it is edited, so switching never loses anything.
  const handleOpen = async (templateId: string) => {
    if (templateId === activeTemplateId) return;
    if (await attempt(openTemplate(templateId), 'Could not open that template')) {
      setActiveSidebarTab('content');
    }
  };

  if (templates.length === 0) return <NoTemplates />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Templates</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setStartOpen(true)}
          aria-label="New template"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {templates.map((tmpl) => (
          <TemplateCard
            key={tmpl.id}
            template={tmpl}
            isActive={tmpl.id === activeTemplateId}
            onOpen={(id) => void handleOpen(id)}
          />
        ))}
      </div>
    </div>
  );
}
