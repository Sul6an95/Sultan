import { format, addDays, subDays } from "date-fns";

interface DateTabsProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
}

export function DateTabs({ selectedDate, onChange }: DateTabsProps) {
  const today = new Date();
  
  const tabs = [
    { label: "Yesterday", date: subDays(today, 1) },
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
  ];

  const isSameDay = (d1: Date, d2: Date) => 
    format(d1, 'yyyy-MM-dd') === format(d2, 'yyyy-MM-dd');

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => {
        const active = isSameDay(selectedDate, tab.date);
        return (
          <button
            key={tab.label}
            onClick={() => onChange(tab.date)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              active 
                ? "bg-primary text-primary-foreground" 
                : "text-white/60 hover:text-white/90"
            }`}
            data-testid={`button-date-${tab.label}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
