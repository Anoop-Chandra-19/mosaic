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

  const saveIfValid = (nextRaw: string, current: string, onSave: (value: string) => void) => {
    const next = nextRaw.trim();
    if (!next || next === current) return;
    onSave(next);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader>
          <DrawerTitle>Edit Entry</DrawerTitle>
          <DrawerDescription>Update fields, toggles, and bullets for this item.</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-2 overscroll-contain">
          <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/40 px-3 py-2">
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
                onBlur={(e) =>
                  saveIfValid(e.target.value, entry.text ?? '', (text) =>
                    updateEntry(sectionId, entry.id, { text })
                  )
                }
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
                  onBlur={(e) =>
                    saveIfValid(e.target.value, entry.title ?? '', (title) =>
                      updateEntry(sectionId, entry.id, { title })
                    )
                  }
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
                  onBlur={(e) =>
                    saveIfValid(e.target.value, entry.subtitle ?? '', (subtitle) =>
                      updateEntry(sectionId, entry.id, { subtitle })
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Bullets</h4>
                <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2">
                  {entry.bullets.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">No bullets yet.</p>
                  ) : (
                    entry.bullets.map((bullet) => (
                      <div key={bullet.id} className="flex items-start gap-1.5">
                        <Checkbox
                          checked={bullet.selected}
                          onCheckedChange={() => toggleBullet(sectionId, entry.id, bullet.id)}
                          className="mt-2 shrink-0"
                          aria-label="Toggle bullet visibility"
                        />
                        <Input
                          defaultValue={bullet.text}
                          autoComplete="off"
                          onBlur={(e) =>
                            saveIfValid(e.target.value, bullet.text, (text) =>
                              updateBullet(sectionId, entry.id, bullet.id, text)
                            )
                          }
                          placeholder="Add achievement detail…"
                          className="min-w-0 flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeBullet(sectionId, entry.id, bullet.id)}
                          aria-label="Delete bullet"
                          className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
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
