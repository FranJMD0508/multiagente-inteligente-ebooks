import { Fragment } from "react";
import { cn } from "@/lib/cn";

// Renderizador mínimo del Markdown que producen los agentes: párrafos, H3,
// listas, citas, **negrita** y *cursiva*. Mantiene la jerarquía de RA-01.

function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

interface ProseProps {
  text: string;
  /** Aplica letra capitular al primer párrafo. */
  dropCap?: boolean;
  /** Muestra el cursor de escritura al final (streaming). */
  caret?: boolean;
  className?: string;
}

function isParagraph(block: string): boolean {
  const trimmed = block.trim();
  if (trimmed.startsWith("### ")) return false;
  const lines = trimmed.split("\n");
  return !(lines.every((l) => /^[-*] /.test(l)) || lines.every((l) => /^\d+\. /.test(l)) || lines.every((l) => l.startsWith(">")));
}

export function Prose({ text, dropCap, caret, className }: ProseProps) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  const firstParagraph = blocks.findIndex(isParagraph);
  const caretEl = caret ? <span className="cursor-tinta" aria-hidden /> : null;

  return (
    <div className={cn("grid gap-[0.85em]", className)}>
      {blocks.map((block, i) => {
        const last = i === blocks.length - 1;
        const trimmed = block.trim();
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="mt-[0.4em] font-display text-[1.08em] font-medium tracking-[-0.01em] text-[#1b1d23]">
              {inline(trimmed.slice(4))}
              {last && caretEl}
            </h4>
          );
        }
        const lines = trimmed.split("\n");
        if (lines.every((l) => /^[-*] /.test(l))) {
          return (
            <ul key={i} className="grid list-disc gap-[0.3em] pl-[1.3em] marker:text-[#0e7c74]">
              {lines.map((l, j) => (
                <li key={j}>
                  {inline(l.slice(2))}
                  {last && j === lines.length - 1 && caretEl}
                </li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return (
            <ol key={i} className="grid list-decimal gap-[0.3em] pl-[1.4em] marker:text-[#0e7c74]">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>
              ))}
            </ol>
          );
        }
        if (lines.every((l) => l.startsWith(">"))) {
          return (
            <blockquote key={i} className="rounded-r-md border-l-2 border-[#0e7c74] bg-[#f4f7f7] py-[0.4em] pl-[0.9em] pr-[0.6em] text-[#33363d]">
              {inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "))}
            </blockquote>
          );
        }
        return (
          <p key={i} className={cn(dropCap && i === firstParagraph && "capitular")}>
            {inline(trimmed.replace(/\n/g, " "))}
            {last && caretEl}
          </p>
        );
      })}
      {blocks.length === 0 && caretEl && <p>{caretEl}</p>}
    </div>
  );
}
