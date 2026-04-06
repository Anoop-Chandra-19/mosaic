import { Mail, Phone, MapPin, Linkedin, Github, Globe, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InlineEditField } from './InlineEditField';
import { useResumeStore } from '@/stores/resumeStore';
import type { ContactInfo } from '@/types/resume';
import type { LucideIcon } from 'lucide-react';

const CONTACT_FIELDS: { key: keyof Omit<ContactInfo, 'name'>; label: string; icon: LucideIcon }[] =
  [
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'phone', label: 'Phone', icon: Phone },
    { key: 'location', label: 'Location', icon: MapPin },
    { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
    { key: 'github', label: 'GitHub', icon: Github },
    { key: 'website', label: 'Website', icon: Globe },
  ];

export function ContactCard() {
  const contact = useResumeStore((s) => s.contact);
  const updateContact = useResumeStore((s) => s.updateContact);

  return (
    <Collapsible defaultOpen className="rounded-md border p-4">
      <div className="flex items-center justify-between">
        <InlineEditField
          value={contact.name}
          onSave={(v) => updateContact({ name: v })}
          className="text-lg leading-tight font-semibold"
          inputClassName="h-8 text-lg leading-tight font-semibold"
          as="h3"
        />
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground [&_svg]:size-3.5"
          >
            <ChevronsUpDown />
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
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
