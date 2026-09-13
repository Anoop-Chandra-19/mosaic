import { AlwaysOn, SettingRow } from '../SettingRow';

export function GeneralSection() {
  return (
    <SettingRow
      label="Autosave"
      description="Every edit is saved on this machine as you type. Name a version when you want to find a state again."
    >
      <AlwaysOn />
    </SettingRow>
  );
}
