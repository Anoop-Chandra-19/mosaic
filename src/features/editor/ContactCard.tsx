import { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  ChevronsUpDown,
  ChevronsDownUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InlineEditField } from './InlineEditField';
import { useResumeStore } from '@/stores/resumeStore';
import type { ContactInfo } from '@/types/resume';
import type { LucideIcon } from 'lucide-react';

type ContactValueKey = 'email' | 'phone' | 'location' | 'linkedin' | 'github' | 'website';

const CONTACT_FIELDS: { key: ContactValueKey; label: string; icon: LucideIcon }[] = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'github', label: 'GitHub', icon: Github },
  { key: 'website', label: 'Website', icon: Globe },
];

const SOCIAL_VISIBILITY: Record<
  Exclude<ContactValueKey, 'email' | 'phone' | 'location'>,
  keyof ContactInfo
> = {
  linkedin: 'showLinkedin',
  github: 'showGithub',
  website: 'showWebsite',
};

export function ContactCard() {
  const contact = useResumeStore((s) => s.contact);
  const updateContact = useResumeStore((s) => s.updateContact);
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border p-4">
      <div className="flex items-center justify-between">
        <InlineEditField
          value={contact.name}
          onSave={(v) => updateContact({ name: v })}
          className="text-lg leading-tight font-semibold"
          inputClassName="h-8 text-lg leading-tight font-semibold"
          as="h3"
        />
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">
            {open ? (
              <ChevronsDownUp className="size-4 stroke-[1.75]" />
            ) : (
              <ChevronsUpDown className="size-4 stroke-[1.75]" />
            )}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-3 grid gap-2">
          {CONTACT_FIELDS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center gap-2.5">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <InlineEditField
                value={contact[key]}
                onSave={(v) => updateContact({ [key]: v })}
                placeholder={label}
                className="truncate text-sm leading-6"
                inputClassName="h-8 text-sm leading-6"
              />
              {key in SOCIAL_VISIBILITY && (
                <label className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <Checkbox
                    checked={
                      contact[SOCIAL_VISIBILITY[key as keyof typeof SOCIAL_VISIBILITY]] !== false
                    }
                    onCheckedChange={(checked) =>
                      updateContact({
                        [SOCIAL_VISIBILITY[key as keyof typeof SOCIAL_VISIBILITY]]:
                          checked === true,
                      })
                    }
                    aria-label={`Show ${label} in preview`}
                    className="size-3.5"
                  />
                  Show
                </label>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
