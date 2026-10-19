import { useRef, type ReactNode } from 'react';
import { AppMenu, AppMenuContent, AppMenuSeparator, AppMenuTrigger } from '@/components/AppMenu';
import { SECTION_PRESETS } from '@shared/resume/sectionPresets';
import type { BuiltInSectionKind } from '@shared/types/resume';
import { useOutlineStore } from '@/stores/outlineStore';
import { useResumeStore } from '@/stores/resumeStore';
import { AnotherLikeMenuItem, CustomMenuItems, PresetMenuItems } from './SectionMenuItems';
import { findLastSectionOfKind, sectionKindsToAdd } from './sectionKindsToAdd';
import { useAddCustomSection } from './useAddCustomSection';

/**
 * Add section, from whichever button opens it (under the last section, or the pane's +): the
 * kinds the resume doesn't have yet, another like one it has, or a custom shape. The section
 * it adds is noted, so the outline brings it into view.
 */
export function AddSectionMenu({
  isOpen,
  onOpenChange,
  align,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  align: 'start' | 'end';
  /** The button that opens it. */
  children: ReactNode;
}) {
  const sections = useResumeStore((s) => s.sections);
  const addSection = useResumeStore((s) => s.addSection);
  const noteSectionAdded = useOutlineStore((s) => s.noteSectionAdded);
  const custom = useAddCustomSection((id) => noteSectionAdded(id, true));
  // Noted once the menu has closed: focus going back to its button would cut the scroll short.
  const addedId = useRef<string | null>(null);

  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const { missing, again } = sectionKindsToAdd(sorted);
  const addKind = (kind: BuiltInSectionKind, afterSectionId?: string) => {
    addedId.current = addSection({ kind, ...SECTION_PRESETS[kind] }, afterSectionId);
  };
  const handleCloseAutoFocus = (event: Event) => {
    custom.onCloseAutoFocus(event);
    if (addedId.current) noteSectionAdded(addedId.current, false);
    addedId.current = null;
  };

  return (
    <AppMenu open={isOpen} onOpenChange={onOpenChange}>
      <AppMenuTrigger asChild>{children}</AppMenuTrigger>
      <AppMenuContent align={align} onCloseAutoFocus={handleCloseAutoFocus}>
        <PresetMenuItems kinds={missing} onAdd={(kind) => addKind(kind)} />
        {missing.length > 0 && again.length > 0 && <AppMenuSeparator />}
        {again.length > 0 && (
          <AnotherLikeMenuItem
            kinds={again}
            onAdd={(kind) => addKind(kind, findLastSectionOfKind(sorted, kind))}
          />
        )}
        {(missing.length > 0 || again.length > 0) && <AppMenuSeparator />}
        <CustomMenuItems onChoose={custom.choose} />
      </AppMenuContent>
    </AppMenu>
  );
}
