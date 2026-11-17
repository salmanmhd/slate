import React from 'react';

/**
 * Renders `backtick` spans as highlighted inline code, the way Notion does.
 * The stored text is untouched — the backticks only disappear on display.
 * `soft` mutes the code colour for dense lists, where red tags shout.
 */
export function InlineText({ text, tone = 'accent' }: { text: string; tone?: 'accent' | 'soft' }) {
  return (
    <>
      {text.split(/(`[^`\n]+`)/g).map((part, i) =>
        part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
          <code
            key={i}
            className={`rounded-[0.3em] bg-muted px-[0.35em] py-[0.1em] font-mono text-[0.88em] font-normal ${
              tone === 'soft' ? 'text-muted-foreground' : 'text-q-do-first'
            }`}
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
