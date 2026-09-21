import { useState } from 'react';
import { AppButton } from '@/components/AppButton';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  AGENT_PANE_WIDTH,
  clampPaneWidth,
  SIDEBAR_WIDTH,
  useUiStore,
  type PaneWidthLimits,
  type ThemeChoice,
} from '@/stores/uiStore';
import { SettingRow } from '../SettingRow';

export function AppearanceSection() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const shouldShowPreview = useUiStore((s) => s.shouldShowPreview);
  const setShouldShowPreview = useUiStore((s) => s.setShouldShowPreview);
  const sidebarWidthPx = useUiStore((s) => s.sidebarWidthPx);
  const setSidebarWidthPx = useUiStore((s) => s.setSidebarWidthPx);
  const agentPaneWidthPx = useUiStore((s) => s.agentPaneWidthPx);
  const setAgentPaneWidthPx = useUiStore((s) => s.setAgentPaneWidthPx);

  return (
    <>
      <SettingRow
        label="Theme"
        description="System follows your operating system, and changes when it does."
      >
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={theme}
          // A single-choice group reports '' when the pressed item is pressed again.
          onValueChange={(value) => value && setTheme(value as ThemeChoice)}
          aria-label="Theme"
        >
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="system">System</ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      <SettingRow
        label="Show live preview"
        description="Turn off to edit content full-width on a small screen."
      >
        <Switch
          checked={shouldShowPreview}
          onCheckedChange={setShouldShowPreview}
          aria-label="Show live preview"
        />
      </SettingRow>
      <SettingRow
        label="Sidebar width"
        description={`The content and templates pane, in pixels (${SIDEBAR_WIDTH.minPx} to ${SIDEBAR_WIDTH.maxPx}). Dragging its edge sets this too. On a small window it narrows to leave the preview room.`}
      >
        <PaneWidthField
          label="Sidebar width"
          widthPx={sidebarWidthPx}
          limits={SIDEBAR_WIDTH}
          onChange={setSidebarWidthPx}
        />
      </SettingRow>
      <SettingRow
        label="Assistant width"
        description={`The assistant pane, in pixels (${AGENT_PANE_WIDTH.minPx} to ${AGENT_PANE_WIDTH.maxPx}), while AI is on.`}
      >
        <PaneWidthField
          label="Assistant width"
          widthPx={agentPaneWidthPx}
          limits={AGENT_PANE_WIDTH}
          onChange={setAgentPaneWidthPx}
        />
      </SettingRow>
    </>
  );
}

/**
 * A pane's width as a number. It is applied when the field is left or Enter is pressed,
 * clamped to the pane's limits, and the field then shows the width actually used.
 */
function PaneWidthField({
  label,
  widthPx,
  limits,
  onChange,
}: {
  label: string;
  widthPx: number;
  limits: PaneWidthLimits;
  onChange: (px: number) => void;
}) {
  // What is being typed; null while the field shows the stored width.
  const [draft, setDraft] = useState<string | null>(null);

  const apply = () => {
    if (draft === null) return;
    const typed = Number(draft);
    onChange(draft.trim() === '' ? widthPx : clampPaneWidth(typed, limits));
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        min={limits.minPx}
        max={limits.maxPx}
        step={10}
        value={draft ?? String(widthPx)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === 'Enter') apply();
          if (event.key === 'Escape') setDraft(null);
        }}
        aria-label={label}
        className="h-8 w-20 text-right font-mono text-sm"
      />
      <span className="text-xs text-zinc-500">px</span>
      <AppButton
        variant="ghost"
        size="sm"
        disabled={widthPx === limits.defaultPx && draft === null}
        onClick={() => {
          setDraft(null);
          onChange(limits.defaultPx);
        }}
      >
        Reset
      </AppButton>
    </div>
  );
}
