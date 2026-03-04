import { useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-20 w-20",
};

const iconSize = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-8 w-8",
};

const textSize = {
  sm: "text-[11px]",
  md: "text-sm",
  lg: "text-base",
  xl: "text-2xl",
};

// Generate a consistent gradient from a name string
function nameToGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 55%, 48%), hsl(${h2}, 60%, 42%))`;
}

export function ContactAvatar({ photoUrl, name, size = "md", className }: ContactAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : null;

  const gradient = name ? nameToGradient(name) : undefined;

  return (
    <div
      className={cn(
        sizeMap[size],
        "rounded-full shrink-0 overflow-hidden flex items-center justify-center relative",
        "ring-1 ring-border/50",
        !photoUrl || imgError ? "" : "",
        className
      )}
      style={
        !photoUrl || imgError
          ? gradient
            ? { background: gradient }
            : undefined
          : undefined
      }
    >
      {photoUrl && !imgError ? (
        <img
          src={photoUrl}
          alt={name || "Contact"}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setImgError(true)}
        />
      ) : initials ? (
        <span className={cn("font-semibold text-white/90 select-none", textSize[size])}>
          {initials}
        </span>
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-muted">
          <User className={cn("text-muted-foreground", iconSize[size])} />
        </div>
      )}
    </div>
  );
}
