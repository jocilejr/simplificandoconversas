import { Bold, Italic, Strikethrough, Underline, Sun, Sunrise, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + prefix.length,
            end + prefix.length
          );
        }, 0);
      } else {
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

  const insertVariable = useCallback(
    (variable: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const tag = `{{${variable}}}`;
      const newText = value.substring(0, start) + tag + value.substring(end);
      onChange(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    },
    [value, onChange, textareaRef]
  );

  const formats = [
    { icon: Bold, wrap: "*", label: "Negrito" },
    { icon: Italic, wrap: "_", label: "Itálico" },
    { icon: Strikethrough, wrap: "~", label: "Riscado" },
  ];

  const variables = [
    { name: "saudacao", label: "Saudação", icon: Sun, description: "Bom dia / Boa tarde / Boa noite (Brasília)" },
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
      <div className="w-px h-4 bg-border mx-0.5" />
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] font-mono" title="Inserir variável">
            {"{x}"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          <p className="text-[10px] text-muted-foreground px-2 py-1 uppercase tracking-wider">Variáveis</p>
          {variables.map(({ name, label, icon: VarIcon, description }) => (
            <button
              key={name}
              className="flex items-center gap-2 w-full p-2 rounded hover:bg-secondary transition-colors text-left"
              onClick={() => insertVariable(name)}
            >
              <VarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium">{label}</p>
                <p className="text-[10px] text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
