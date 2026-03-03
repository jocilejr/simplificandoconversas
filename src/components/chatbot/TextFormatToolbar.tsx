import { Bold, Italic, Strikethrough, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useCallback } from "react";

interface TextFormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
}

export function TextFormatToolbar({ textareaRef, value, onChange }: TextFormatToolbarProps) {
  const wrapSelection = useCallback(
    (prefix: string, suffix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.substring(start, end);

      if (selected) {
        const newText =
          value.substring(0, start) +
          prefix +
          selected +
          suffix +
          value.substring(end);
        onChange(newText);
        // Restore cursor
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + prefix.length,
            end + prefix.length
          );
        }, 0);
      } else {
        // Insert wrapper at cursor
        const newText =
          value.substring(0, start) +
          prefix +
          suffix +
          value.substring(end);
        onChange(newText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + prefix.length,
            start + prefix.length
          );
        }, 0);
      }
    },
    [value, onChange, textareaRef]
  );

  const formats = [
    { icon: Bold, wrap: "*", label: "Negrito" },
    { icon: Italic, wrap: "_", label: "Itálico" },
    { icon: Strikethrough, wrap: "~", label: "Riscado" },
  ];

  return (
    <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5 bg-muted/50">
      {formats.map(({ icon: Icon, wrap, label }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title={label}
          onClick={() => wrapSelection(wrap, wrap)}
        >
          <Icon className="h-3 w-3" />
        </Button>
      ))}
    </div>
  );
}
