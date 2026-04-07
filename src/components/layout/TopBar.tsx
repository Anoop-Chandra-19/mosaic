import { Moon, Sun, Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/useIsMobile';
import { useUIStore } from '@/stores/uiStore';

export function TopBar() {
  const { darkMode, mobilePane, toggleDarkMode, setMobilePane } = useUIStore();
  const isMobile = useIsMobile();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 font-bold text-white">
          M
        </div>
        <span className="text-lg font-semibold">Mosaic</span>
      </div>

      <div className="flex items-center gap-1">
        {isMobile && (
          <div className="mr-1 flex items-center rounded-md border border-border p-0.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setMobilePane('editor')}
              className={cn(
                'h-7 px-2 text-xs',
                mobilePane === 'editor' && 'bg-muted text-foreground'
              )}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setMobilePane('preview')}
              className={cn(
                'h-7 px-2 text-xs',
                mobilePane === 'preview' && 'bg-muted text-foreground'
              )}
            >
              Preview
            </Button>
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={toggleDarkMode} aria-label="Toggle theme">
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" aria-label="Open settings">
          <Settings className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Export resume">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Export as PDF</DropdownMenuItem>
            <DropdownMenuItem>Copy as Markdown</DropdownMenuItem>
            <DropdownMenuItem>Copy as Plaintext</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
