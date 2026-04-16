import { Ellipsis, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ItemActionsMenuProps {
  label: string;
  deleteLabel?: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemActionsMenu({
  label,
  deleteLabel = 'Delete',
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  open,
  onOpenChange,
}: ItemActionsMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          className="text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground [&_svg]:size-3.5"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onMoveUp} disabled={isFirst}>
          Move Up
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMoveDown} disabled={isLast}>
          Move Down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
