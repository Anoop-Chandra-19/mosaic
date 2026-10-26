/**
 * Mosaic's public UI primitives and text roles. Screens import from this file;
 * implementations and private helpers live in kit/ and use direct file imports, never
 * back through this entry point. Raw shadcn parts, internal styling helpers, hooks,
 * and domain-specific components are not part of this entry point.
 */
export { AppButton } from './kit/AppButton';
export { AppCheckbox } from './kit/AppCheckbox';
export { AppCollapsible, AppCollapsibleContent, AppCollapsibleTrigger } from './kit/AppCollapsible';
export {
  AppCommand,
  AppCommandEmpty,
  AppCommandField,
  AppCommandGroup,
  AppCommandInput,
  AppCommandItem,
  AppCommandList,
} from './kit/AppCommand';
export {
  AppDialog,
  AppDialogContent,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
} from './kit/AppDialog';
export { AppInput } from './kit/AppInput';
export {
  AppMenu,
  AppMenuCheckboxItem,
  AppMenuContent,
  AppMenuItem,
  AppMenuLabel,
  AppMenuRadioGroup,
  AppMenuRadioItem,
  AppMenuSeparator,
  AppMenuSub,
  AppMenuSubContent,
  AppMenuSubTrigger,
  AppMenuTrigger,
} from './kit/AppMenu';
export {
  AppPopover,
  AppPopoverAnchor,
  AppPopoverContent,
  AppPopoverTrigger,
} from './kit/AppPopover';
export { AppRadioGroup, AppRadioGroupItem } from './kit/AppRadioGroup';
export {
  AppSelect,
  AppSelectContent,
  AppSelectItem,
  AppSelectTrigger,
  AppSelectValue,
} from './kit/AppSelect';
export { AppSwitch } from './kit/AppSwitch';
export { AppTabs, AppTabsContent, AppTabsList, AppTabsTrigger } from './kit/AppTabs';
export { AppTextarea } from './kit/AppTextarea';
export { AppToggleGroup, AppToggleGroupItem } from './kit/AppToggleGroup';
export { AppTooltip, AppTooltipProvider } from './kit/AppTooltip';
export { Badge } from './kit/Badge';
export { Chip } from './kit/Chip';
export { DialogFrameBody, DialogFrameFooter, DialogFrameHeader } from './kit/DialogFrame';
export { Note } from './kit/Note';
export { ReadingColumn } from './kit/ReadingColumn';
export { Text } from './kit/Text';
export { textVariantClasses, type TextVariant } from './kit/textVariants';
