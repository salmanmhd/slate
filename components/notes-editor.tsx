'use client';

import React from 'react';
import { Bold, Heading } from 'lucide-react';

/**
 * Plain-text notes with two bits of markdown: `**bold**` and `## heading`.
 * Stored as text, so nothing else in the app has to know about formatting.
 * Shows rendered while you read, the raw text while you edit.
 */
export function NotesEditor({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = React.useState(!value);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const edit = (next: string, selStart: number, selEnd: number) => {
    onChange(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(selStart, selEnd);
    });
  };

  const toggleBold = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const selected = value.slice(a, b);
    if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
      edit(value.slice(0, a) + selected.slice(2, -2) + value.slice(b), a, b - 4);
    } else if (value.slice(a - 2, a) === '**' && value.slice(b, b + 2) === '**') {
      edit(value.slice(0, a - 2) + selected + value.slice(b + 2), a - 2, b - 2);
    } else {
      edit(value.slice(0, a) + `**${selected}**` + value.slice(b), a + 2, b + 2);
    }
  };

  const toggleHeading = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const lineStart = value.lastIndexOf('\n', a - 1) + 1;
    if (value.startsWith('## ', lineStart)) {
      edit(value.slice(0, lineStart) + value.slice(lineStart + 3), Math.max(lineStart, a - 3), Math.max(lineStart, b - 3));
    } else {
      edit(value.slice(0, lineStart) + '## ' + value.slice(lineStart), a + 3, b + 3);
    }
  };

  /** Toolbar clicks open the editor first, so the shortcut and the button behave the same. */
  const handleToolbar = (e: React.MouseEvent, action: 'bold' | 'heading') => {
    e.preventDefault();
    const run = () => (action === 'bold' ? toggleBold() : toggleHeading());
    if (!isEditing) {
      setIsEditing(true);
      requestAnimationFrame(run);
    } else {
      run();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Notes</p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => handleToolbar(e, 'bold')}
            className="focus-ring rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            title="Bold (Ctrl+B)"
            aria-label="Bold"
          >
            <Bold className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => handleToolbar(e, 'heading')}
            className="focus-ring rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            title="Heading (Ctrl+H)"
            aria-label="Heading"
          >
            <Heading className="size-3.5" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <textarea
          ref={ref}
          autoFocus={Boolean(value)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            onCommit();
            if (value.trim()) setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              e.currentTarget.blur();
              return;
            }
            const mod = e.ctrlKey || e.metaKey;
            if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
              e.preventDefault();
              toggleBold();
            }
            if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
              e.preventDefault();
              toggleHeading();
            }
          }}
          placeholder={placeholder}
          className="min-h-40 w-full flex-1 resize-none rounded-xl border border-border/60 bg-background p-3 text-sm leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="focus-ring min-h-40 w-full flex-1 cursor-text overflow-y-auto rounded-xl border border-border/60 bg-background p-3 text-left text-sm leading-relaxed text-foreground transition-colors hover:border-foreground/20"
          title="Click to edit"
        >
          <RenderedNotes text={value} />
        </button>
      )}
    </div>
  );
}

function RenderedNotes({ text }: { text: string }) {
  return (
    <span className="block">
      {text.split('\n').map((line, i) => {
        const heading = line.match(/^#{1,3} (.*)$/);
        if (heading) {
          return (
            <span key={i} className="mt-2 block text-base font-semibold text-foreground first:mt-0">
              <Inline text={heading[1]} />
            </span>
          );
        }
        if (!line.trim()) return <span key={i} className="block h-3" />;
        return (
          <span key={i} className="block whitespace-pre-wrap">
            <Inline text={line} />
          </span>
        );
      })}
    </span>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
