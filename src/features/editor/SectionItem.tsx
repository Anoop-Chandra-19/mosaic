import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import { InlineEditField } from './InlineEditField';
import { CUSTOM_ICONS, PRESET_ICONS } from './section-icons';
import { EntryCard } from './EntryCard';
import type { ResumeSection } from '@/types/resume';
import { useResumeStore } from '@/stores/resumeStore';

interface SectionItemProps {
  section: ResumeSection;
  /** Just added and still unnamed: show the name open for editing. */
  nameAtStart?: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function SectionItem({
  section,
  nameAtStart = false,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: SectionItemProps) {
  const updateSectionLabel = useResumeStore((s) => s.updateSectionLabel);
  const removeSection = useResumeStore((s) => s.removeSection);
  const addEntry = useResumeStore((s) => s.addEntry);
  const reorderEntries = useResumeStore((s) => s.reorderEntries);
  const [open, setOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  // A custom section has no kind to go by, so its icon shows its shape.
  const Icon =
    section.kind === 'custom' ? CUSTOM_ICONS[section.layout] : PRESET_ICONS[section.kind];

  const handleAddEntry = () => {
    addEntry(section.id, {
      selected: true,
      bullets: [],
      ...(section.layout === 'lines' ? { text: '' } : { title: '', subtitle: '' }),
    });
  };

  const moveEntry = (index: number, direction: -1 | 1) => {
    const ids = section.items.map((e) => e.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderEntries(section.id, ids);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group/section flex items-center gap-1.5 py-1.5">
        <CollapsibleTrigger asChild>
          <AppButton
            variant="ghost"
            size="icon-xs"
            aria-label={open ? `Collapse ${section.label}` : `Expand ${section.label}`}
            className="shrink-0 text-muted-foreground [&_svg]:size-3.5"
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </AppButton>
        </CollapsibleTrigger>
        <Icon className="size-[1.05rem] shrink-0 text-muted-foreground" />
        <InlineEditField
          value={section.label}
          onSave={(v) => updateSectionLabel(section.id, v)}
          openAtStart={nameAtStart}
          label="Section name"
          placeholder="Section name"
          className="truncate text-base leading-6 font-medium"
          inputClassName="h-8 text-base leading-6 font-medium"
        />
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-sm leading-none text-muted-foreground">
          {section.items.length}
        </span>
        <div
          className={`flex shrink-0 items-center ${
            actionsOpen
              ? 'visible'
              : 'invisible group-hover/section:visible group-focus-within/section:visible'
          }`}
        >
          <AppButton
            variant="ghost"
            size="icon-xs"
            onClick={handleAddEntry}
            aria-label={`Add entry to ${section.label}`}
            className="text-muted-foreground [&_svg]:size-3.5"
          >
            <Plus />
          </AppButton>
          <ItemActionsMenu
            label={`${section.label} actions`}
            deleteLabel="Delete Section"
            isFirst={isFirst}
            isLast={isLast}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={() => setConfirmOpen(true)}
            open={actionsOpen}
            onOpenChange={setActionsOpen}
          />
        </div>
      </div>

      <CollapsibleContent>
        <div className="ml-4 space-y-2 pb-3 pl-4">
          {section.items.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No entries yet. Click + to add one.
            </p>
          ) : (
            section.items.map((entry, i) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                sectionId={section.id}
                layout={section.layout}
                isFirst={i === 0}
                isLast={i === section.items.length - 1}
                onMoveUp={() => moveEntry(i, -1)}
                onMoveDown={() => moveEntry(i, 1)}
              />
            ))
          )}
        </div>
      </CollapsibleContent>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete section?"
        description={`This will permanently remove \u201c${section.label}\u201d and all its entries.`}
        onConfirm={() => removeSection(section.id)}
      />
    </Collapsible>
  );
}
