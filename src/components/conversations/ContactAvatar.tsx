import { useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const iconSize = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const textSize = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function ContactAvatar({ photoUrl, name, size = "md", className }: ContactAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : null;

  return (
    <div
      className={cn(
        sizeMap[size],
        "rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-muted",
        className
      )}
    >
      {photoUrl && !imgError ? (
        <img
          src={photoUrl}
          alt={name || "Contact"}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : initials ? (
        <span className={cn("font-semibold text-muted-foreground", textSize[size])}>
          {initials}
        </span>
      ) : (
        <User className={cn("text-muted-foreground", iconSize[size])} />
      )}
    </div>
  );
}
