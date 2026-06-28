import * as React from "react";
import { useState, useCallback } from "react";
import { Check, ChevronsUpDown, type LucideIcon } from "lucide-react";
import type { Subset } from "../../lib/api";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "../ui/command";
import { useAuth } from "../../context/auth";
import { SubsetIdentifier } from "./SubsetIdentifier";
import { cn } from "../../lib/utils";

const DISPLAY_LIMIT = 50;

type SubsetSelectorProps = {
  value: Subset[];
  onChange: (subsets: Subset[]) => void;
  options: Subset[];
  disabledIds?: number[];
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  startIcon?: LucideIcon;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SubsetSelector({
  value,
  onChange,
  options,
  disabledIds = [],
  disabled = false,
  placeholder = "Select subsets",
  label,
  startIcon: StartIcon,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SubsetSelectorProps): React.ReactElement {
  const { user } = useAuth();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setUncontrolledOpen;
  const [search, setSearch] = useState("");
  const [trainedOnly, setTrainedOnly] = useState(false);
  const [createdByMe, setCreatedByMe] = useState(false);

  const selectedIds = new Set(value.map((s) => s.id));

  const filtered = options
    .filter((s) => !trainedOnly || s.hasTrained === true)
    .filter((s) => !createdByMe || (user != null && s.ownedBy.id === user.id))
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const tA = a.lockedAt ? new Date(a.lockedAt).getTime() : 0;
      const tB = b.lockedAt ? new Date(b.lockedAt).getTime() : 0;
      return tB - tA;
    });

  const displayed = filtered.slice(0, DISPLAY_LIMIT);
  const overflow = filtered.length - DISPLAY_LIMIT;

  const toggle = useCallback(
    (subset: Subset) => {
      if (disabledIds.includes(subset.id)) return;
      const isSelected = selectedIds.has(subset.id);
      onChange(isSelected ? value.filter((s) => s.id !== subset.id) : [...value, subset]);
    },
    [value, onChange, selectedIds, disabledIds],
  );

  const triggerLabel =
    label ??
    (value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0]!.name
        : `${value.length} subsets`);

  const filterBtn = (active: boolean, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {isControlled ? (
          <span className="sr-only" aria-hidden />
        ) : (
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-8 w-fit items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
              open && "border-ring ring-1 ring-ring",
              !label && value.length > 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {StartIcon && <StartIcon className="h-3.5 w-3.5 shrink-0" />}
            <span>{triggerLabel}</span>
            {!StartIcon && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />}
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search subsets…"
            value={search}
            onValueChange={setSearch}
          />
          <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
            {filterBtn(trainedOnly, () => setTrainedOnly((v) => !v), "Trained by me")}
            {filterBtn(createdByMe, () => setCreatedByMe((v) => !v), "Created by me")}
          </div>
          <CommandList>
            {displayed.length === 0 ? (
              <CommandEmpty>No subsets found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {displayed.map((s) => {
                  const isSelected = selectedIds.has(s.id);
                  const isDisabled = disabledIds.includes(s.id);
                  return (
                    <CommandItem
                      key={s.id}
                      value={String(s.id)}
                      onSelect={() => toggle(s)}
                      disabled={isDisabled}
                      className={cn(
                        isSelected && "bg-accent",
                        isDisabled && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <SubsetIdentifier subset={s} className="flex-1" />
                      {s.hasTrained && (
                        <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          trained
                        </span>
                      )}
                      {isSelected && (
                        <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-foreground/60" />
                      )}
                    </CommandItem>
                  );
                })}
                {overflow > 0 && (
                  <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                    {overflow} more — refine your search
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
