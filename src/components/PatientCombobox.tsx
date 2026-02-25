import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Option {
  value: string;
  label: string;
}

interface PatientComboboxProps {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  showAll?: boolean;
  className?: string;
}

export function PatientCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Selecione",
  allLabel = "Todos os Pacientes",
  showAll = false,
  className,
}: PatientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = useMemo(() => {
    if (showAll && value === "all") return allLabel;
    return options.find(o => o.value === value)?.label || placeholder;
  }, [value, options, showAll, allLabel, placeholder]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {showAll && (
            <button
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                value === "all" && "bg-accent"
              )}
              onClick={() => { onValueChange("all"); setOpen(false); }}
            >
              <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
              {allLabel}
            </button>
          )}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum resultado</p>
          )}
          {filtered.map(o => (
            <button
              key={o.value}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                value === o.value && "bg-accent"
              )}
              onClick={() => { onValueChange(o.value); setOpen(false); }}
            >
              <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
              {o.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
