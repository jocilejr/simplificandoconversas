import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

interface DateFilterProps {
  startDate?: Date;
  endDate?: Date;
  onDateChange: (start?: Date, end?: Date) => void;
}

const presets = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
];

export function DateFilter({ startDate, endDate, onDateChange }: DateFilterProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const handlePreset = (days: number) => {
    if (days === 0) {
      onDateChange(startOfDay(new Date()), endOfDay(new Date()));
    } else if (days === 1) {
      const yesterday = subDays(new Date(), 1);
      onDateChange(startOfDay(yesterday), endOfDay(yesterday));
    } else {
      onDateChange(startOfDay(subDays(new Date(), days)), endOfDay(new Date()));
    }
    setActivePreset(days);
  };

  const clearFilter = () => {
    onDateChange(undefined, undefined);
    setActivePreset(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <Button
          key={p.days}
          variant={activePreset === p.days ? "default" : "outline"}
          size="sm"
          onClick={() => handlePreset(p.days)}
        >
          {p.label}
        </Button>
      ))}

      <Popover open={showCalendar} onOpenChange={setShowCalendar}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <CalendarIcon className="h-4 w-4 mr-1" />
            {startDate && endDate
              ? `${format(startDate, "dd/MM", { locale: ptBR })} - ${format(endDate, "dd/MM", { locale: ptBR })}`
              : "Período"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: startDate, to: endDate }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onDateChange(startOfDay(range.from), endOfDay(range.to));
                setActivePreset(null);
                setShowCalendar(false);
              }
            }}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {(startDate || endDate) && (
        <Button variant="ghost" size="sm" onClick={clearFilter}>
          Limpar
        </Button>
      )}
    </div>
  );
}
