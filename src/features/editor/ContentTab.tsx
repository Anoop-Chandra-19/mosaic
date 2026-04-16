import { ContactCard } from './ContactCard';
import { SectionList } from './SectionList';

export function ContentTab() {
  return (
    <div className="space-y-5">
      <ContactCard />
      <SectionList />
    </div>
  );
}
