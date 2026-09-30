import { Button } from "@bb/shared-ui/button";
import { Icon } from "@bb/shared-ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@bb/shared-ui/tooltip";
import { useAppCommandShortcut } from "@/components/commands/AppCommandProvider";
import { HEADER_PANE_ACTION_ICON_BUTTON_CLASS } from "@/components/layout/AppPageHeader";
import { CHROME_SUBTLE_ICON_BUTTON_FOREGROUND_CLASS } from "@bb/shared-ui/chrome-style-tokens";
import { cn } from "@bb/shared-ui/lib/utils";
import { usePaneContext } from "./PaneContext";

export function panePinLabel(isPinned: boolean): string {
  return isPinned ? "Unpin pane" : "Pin pane";
}

export function PanePinButton() {
  const { isPinned, onTogglePin } = usePaneContext();
  const shortcut = useAppCommandShortcut("pane.pin.toggle");

  if (onTogglePin === undefined) return null;

  const pinned = isPinned === true;
  const label = panePinLabel(pinned);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            HEADER_PANE_ACTION_ICON_BUTTON_CLASS,
            CHROME_SUBTLE_ICON_BUTTON_FOREGROUND_CLASS,
            "aria-pressed:bg-state-active aria-pressed:text-foreground",
          )}
          aria-label={shortcut ? `${label} (${shortcut.label})` : label}
          aria-keyshortcuts={shortcut?.ariaKeyshortcuts}
          aria-pressed={pinned}
          data-pane-pin-button=""
          onClick={onTogglePin}
        >
          <Icon name="Pin" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span>{label}</span>
        {shortcut ? ` (${shortcut.label})` : ""}
      </TooltipContent>
    </Tooltip>
  );
}
