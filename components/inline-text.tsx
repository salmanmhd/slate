import React from 'react';

/**
 * Renders `backtick` spans as highlighted inline code, the way Notion does.
 * The stored text is untouched — the backticks only disappear on display.
 */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`\n]+`)/g).map((part, i) =>
        part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
          <code
            key={i}
            className="rounded-[0.3em] bg-muted px-[0.35em] py-[0.1em] font-mono text-[0.88em] font-normal text-q-do-first"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
