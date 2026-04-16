import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SECTION_ICONS, SECTION_TYPE_OPTIONS } from './section-icons';
import { SectionItem } from './SectionItem';
import { useResumeStore } from '@/stores/resumeStore';

export function SectionList() {
  const sections = useResumeStore((s) => s.sections);
  const addSection = useResumeStore((s) => s.addSection);
  const reorderSections = useResumeStore((s) => s.reorderSections);

  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const usedTypes = new Set(sections.map((s) => s.type));
  const availableTypes = SECTION_TYPE_OPTIONS.filter((o) => !usedTypes.has(o.type));

  const moveSection = (index: number, direction: -1 | 1) => {
    const ids = sorted.map((s) => s.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderSections(ids);
  };

  return (
    <div className="space-y-1.5">
      {sorted.map((section, i) => (
        <SectionItem
          key={section.id}
          section={section}
          isFirst={i === 0}
          isLast={i === sorted.length - 1}
          onMoveUp={() => moveSection(i, -1)}
          onMoveDown={() => moveSection(i, 1)}
        />
      ))}

      {availableTypes.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus />
              Add Section
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {availableTypes.map(({ type, label }) => {
              const Icon = SECTION_ICONS[type];
              return (
                <DropdownMenuItem key={type} onClick={() => addSection(type, label)}>
                  <Icon className="mr-2 size-4" />
                  {label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
