import { Wrench } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuLabel,
  AppMenuTrigger,
} from '@/components/AppMenu';
import { Text } from '@/components/Text';
import { attempt, showToast } from '@/stores/toastStore';
import { DEV_TOOLS, type DevTool } from './devTools';

const runTool = (tool: DevTool) =>
  void attempt(tool.run().then(showToast), `“${tool.label}” didn’t finish`);

/** The development tools, in the top bar of development builds only. */
export function DevToolsMenu() {
  return (
    <AppMenu>
      <AppMenuTrigger asChild>
        <AppButton variant="ghost" size="sm" shape="square" aria-label="Developer tools">
          <Wrench className="h-4 w-4" />
        </AppButton>
      </AppMenuTrigger>
      <AppMenuContent align="end" className="w-72">
        <AppMenuLabel>Developer tools</AppMenuLabel>
        {DEV_TOOLS.map((tool) => (
          <AppMenuItem
            key={tool.label}
            onClick={() => runTool(tool)}
            className="flex-col items-start gap-0.5"
          >
            {tool.label}
            <Text variant="secondary" className="text-ink-muted">
              {tool.description}
            </Text>
          </AppMenuItem>
        ))}
      </AppMenuContent>
    </AppMenu>
  );
}
