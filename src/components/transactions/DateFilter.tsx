import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

export type DateFilterType = "today" | "yesterday" | "7days" | "30days" | "custom";

export interface DateFilterValue {
  type: DateFilterType;
  startDate: Date;
  endDate: Date;
}

function getBrazilNow(): Date {
  const brazilDateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(brazilDateStr);
}

export function getDefaultDateFilter(): DateFilterValue {
  const now = getBrazilNow();
  return {
    type: "today",
    startDate: startOfDay(now),
    endDate: endOfDay(now),
  };
}

interface DateFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isOpen, setIsOpen] = useState(false);

  const presets: { label: string; type: DateFilterType }[] = [
    { label: "Hoje", type: "today" },
    { label: "Ontem", type: "yesterday" },
    { label: "7 dias", type: "7days" },
    { label: "30 dias", type: "30days" },
  ];

  const handlePresetClick = (type: DateFilterType) => {
    const now = getBrazilNow();
    let startDate: Date;
    let endDate = endOfDay(now);

    switch (type) {
      case "today":
        startDate = startOfDay(now);
        break;
      case "yesterday":
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case "7days":
        startDate = startOfDay(subDays(now, 6));
        break;
      case "30days":
        startDate = startOfDay(subDays(now, 29));
        break;
      default:
        startDate = startOfDay(now);
    }

    onChange({ type, startDate, endDate });
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      onChange({
        type: "custom",
        startDate: startOfDay(range.from),
        endDate: endOfDay(range.to),
      });
      setIsOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-secondary/30 rounded-lg border border-border/30">
      {presets.map((preset) => (
        <button
          key={preset.type}
          onClick={() => handlePresetClick(preset.type)}
          className={cn(
            "px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all duration-150",
            value.type === preset.type
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          {preset.label}
        </button>
      ))}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-all duration-150",
              value.type === "custom"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {value.type === "custom" ? (
              <span>
                {format(value.startDate, "dd/MM", { locale: ptBR })} - {format(value.endDate, "dd/MM", { locale: ptBR })}
              </span>
            ) : (
              <span className="hidden sm:inline">Personalizado</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={customRange?.from}
            selected={customRange}
            onSelect={handleCustomRangeSelect}
            numberOfMonths={1}
            locale={ptBR}
            className="pointer-events-auto"
            disabled={{ after: getBrazilNow() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
