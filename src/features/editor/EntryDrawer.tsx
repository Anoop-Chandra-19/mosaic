import { Trash2, X } from 'lucide-react';
import { AddBulletInput } from './AddBulletInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EditableBullet } from '@/components/EditableBullet';
import { useSaveOnBlur } from '@/lib/hooks/useSaveOnBlur';
import type { ResumeEntry, SectionType } from '@/types/resume';
import { useResumeStore } from '@/stores/resumeStore';

interface EntryDrawerProps {
  entry: ResumeEntry;
  sectionId: string;
  sectionType: SectionType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestDelete: () => void;
}

const TEXT_ONLY_TYPES: SectionType[] = ['summary', 'skills'];

export function EntryDrawer({
  entry,
  sectionId,
  sectionType,
  open,
  onOpenChange,
  onRequestDelete,
}: EntryDrawerProps) {
  const toggleEntry = useResumeStore((s) => s.toggleEntry);
  const updateEntry = useResumeStore((s) => s.updateEntry);
  const addBullet = useResumeStore((s) => s.addBullet);
  const updateBullet = useResumeStore((s) => s.updateBullet);
  const removeBullet = useResumeStore((s) => s.removeBullet);
  const toggleBullet = useResumeStore((s) => s.toggleBullet);

  const isTextOnly = TEXT_ONLY_TYPES.includes(sectionType);

  const textBlur = useSaveOnBlur(entry.text ?? '', (text) =>
    updateEntry(sectionId, entry.id, { text })
  );
  const titleBlur = useSaveOnBlur(entry.title ?? '', (title) =>
    updateEntry(sectionId, entry.id, { title })
  );
  const subtitleBlur = useSaveOnBlur(entry.subtitle ?? '', (subtitle) =>
    updateEntry(sectionId, entry.id, { subtitle })
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader>
          <DrawerTitle>Edit Entry</DrawerTitle>
          <DrawerDescription>Update fields, toggles, and bullets for this item.</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-2 overscroll-contain">
          <div className="flex items-center justify-between rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <span className="text-sm font-medium">Include This Entry</span>
            <Checkbox
              checked={entry.selected}
              onCheckedChange={() => toggleEntry(sectionId, entry.id)}
              aria-label="Toggle entry visibility"
            />
          </div>

          {isTextOnly ? (
            <div className="space-y-1.5">
              <label htmlFor={`entry-text-${entry.id}`} className="text-sm font-medium">
                Content
              </label>
              <Textarea
                id={`entry-text-${entry.id}`}
                defaultValue={entry.text ?? ''}
                placeholder="Write this entry…"
                autoComplete="off"
                onBlur={textBlur.onBlur}
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor={`entry-title-${entry.id}`} className="text-sm font-medium">
                  Title
                </label>
                <Input
                  id={`entry-title-${entry.id}`}
                  defaultValue={entry.title ?? ''}
                  placeholder="e.g. Senior Software Engineer…"
                  autoComplete="off"
                  onBlur={titleBlur.onBlur}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`entry-subtitle-${entry.id}`} className="text-sm font-medium">
                  Subtitle
                </label>
                <Input
                  id={`entry-subtitle-${entry.id}`}
                  defaultValue={entry.subtitle ?? ''}
                  placeholder="e.g. Acme Corp · Remote…"
                  autoComplete="off"
                  onBlur={subtitleBlur.onBlur}
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Bullets</h4>
                <div className="space-y-2 rounded-md border border-zinc-300 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-950">
                  {entry.bullets.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">No bullets yet.</p>
                  ) : (
                    entry.bullets.map((bullet) => (
                      <EditableBullet
                        key={bullet.id}
                        text={bullet.text}
                        selected={bullet.selected}
                        onToggle={() => toggleBullet(sectionId, entry.id, bullet.id)}
                        onUpdate={(text) => updateBullet(sectionId, entry.id, bullet.id, text)}
                        onRemove={() => removeBullet(sectionId, entry.id, bullet.id)}
                      />
                    ))
                  )}
                  <AddBulletInput onAdd={(text) => addBullet(sectionId, entry.id, text)} />
                </div>
              </div>
            </>
          )}
        </div>

        <DrawerFooter>
          <Button variant="destructive" onClick={onRequestDelete}>
            <Trash2 />
            Delete Entry
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">
              <X />
              Done
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
