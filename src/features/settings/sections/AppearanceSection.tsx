import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUIStore } from '@/stores/uiStore';
import { SettingRow } from '../SettingRow';

export function AppearanceSection() {
  const darkMode = useUIStore((s) => s.darkMode);
  const setDarkMode = useUIStore((s) => s.setDarkMode);

  return (
    <SettingRow label="Theme">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={darkMode ? 'dark' : 'light'}
        // A single-choice group reports '' when the pressed item is pressed again.
        onValueChange={(value) => value && setDarkMode(value === 'dark')}
        aria-label="Theme"
      >
        <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        <ToggleGroupItem value="light">Light</ToggleGroupItem>
      </ToggleGroup>
    </SettingRow>
  );
}
