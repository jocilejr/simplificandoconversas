import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function DailyVerse() {
  const [prayer, setPrayer] = useState<string | null>(null);

  useEffect(() => {
    const fetchDailyPrayer = async () => {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - startOfYear.getTime();
      const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
      const dayNumber = ((dayOfYear - 1) % 100) + 1;

      const { data } = await supabase
        .from("daily_prayers")
        .select("text")
        .eq("day_number", dayNumber)
        .single();

      if (data) {
        setPrayer((data as any).text);
      }
    };

    fetchDailyPrayer();
  }, []);

  if (!prayer) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm">
      <div className="relative px-5 py-4">
        <div className="absolute top-2 left-3 text-gray-100 text-3xl leading-none select-none">🙏</div>
        <div className="pl-8">
          <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2">Oração do dia</p>
          <p className="text-sm text-gray-700 leading-relaxed font-medium" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            {prayer}
          </p>
        </div>
      </div>
    </div>
  );
}
