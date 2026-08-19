'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { BLOCKER_CATEGORIES } from '@/lib/constants';
import { BlockerCategory, Task } from '@/types/matrix';
import { parseTaskInput, formatFriendlyDate } from '@/lib/nlp-parser';
import {
  X,
  Hourglass,
  ZapOff,
  Maximize2,
  Users,
  BatteryLow,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  Hourglass: <Hourglass className="size-3.5" />,
  ZapOff: <ZapOff className="size-3.5" />,
  Maximize2: <Maximize2 className="size-3.5" />,
  Users: <Users className="size-3.5" />,
  BatteryLow: <BatteryLow className="size-3.5" />,
  HelpCircle: <HelpCircle className="size-3.5" />,
  AlertCircle: <AlertCircle className="size-3.5" />,
};

const RESOLUTIONS: {
  id: 'rescheduled' | 'eliminated' | 'marked_failed';
  label: string;
  hint: string;
}[] = [
  { id: 'rescheduled', label: 'Try again later', hint: 'Give it a new date' },
  { id: 'eliminated', label: 'Drop it', hint: "It doesn't need doing" },
  { id: 'marked_failed', label: 'Mark failed', hint: 'Close it out honestly' },
];

export function AccountabilityDialog() {
  const { accountabilityModalTask, accountabilityModalResolutionDefault } = useMatrixStore();

  if (!accountabilityModalTask) return null;

  // Keyed on the task so the form starts fresh per task instead of being
  // re-synced by an effect.
  return (
    <AccountabilityForm
      key={accountabilityModalTask.id}
      task={accountabilityModalTask}
      defaultResolution={accountabilityModalResolutionDefault || 'rescheduled'}
    />
  );
}

function AccountabilityForm({
  task,
  defaultResolution,
}: {
  task: Task;
  defaultResolution: 'rescheduled' | 'eliminated' | 'marked_failed';
}) {
  const { closeAccountabilityModal, recordAccountability } = useMatrixStore();

  const [category, setCategory] = React.useState<BlockerCategory>(
    task.blockerCategory || 'underestimated_time'
  );
  const [reason, setReason] = React.useState(task.failureReason || '');
  const [resolution, setResolution] =
    React.useState<'rescheduled' | 'eliminated' | 'marked_failed'>(defaultResolution);
  const [rescheduleInput, setRescheduleInput] = React.useState('tomorrow 9am');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAccountabilityModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeAccountabilityModal]);

  const parsedReschedule = parseTaskInput(rescheduleInput);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (reason.trim().length < 6) {
      setError('A few words is enough — but write something real.');
      return;
    }

    const newDueDate =
      resolution === 'rescheduled'
        ? (parsedReschedule.parsedDate ?? new Date(Date.now() + 24 * 3600 * 1000)).toISOString()
        : null;

    recordAccountability(task.id, category, reason.trim(), resolution, newDueDate);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={closeAccountabilityModal}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="What blocked this task"
        className="card-depth animate-rise relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/80 bg-card p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">
              What&apos;s in the way?
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {task.content}
              {task.parsedDate && (
                <span className="text-q-do-first"> — due {formatFriendlyDate(task.parsedDate)}</span>
              )}
            </p>
          </div>
          <button
            onClick={closeAccountabilityModal}
            className="focus-ring shrink-0 rounded-lg p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground">Closest reason</label>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {(Object.keys(BLOCKER_CATEGORIES) as BlockerCategory[]).map((key) => {
                const meta = BLOCKER_CATEGORIES[key];
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    title={meta.description}
                    className={`focus-ring flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-foreground/25 bg-muted text-foreground'
                        : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    {iconMap[meta.icon]}
                    <span className="font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="accountability-reason" className="text-xs font-semibold text-foreground">
              In your own words
            </label>
            <textarea
              id="accountability-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="Nobody else reads this."
              className="mt-1.5 w-full resize-none rounded-xl border border-border/60 bg-background p-3 text-xs text-foreground transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:outline-none"
            />
            {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">What happens to it</label>
            <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
              {RESOLUTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setResolution(opt.id)}
                  className={`focus-ring flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${
                    resolution === opt.id
                      ? 'border-foreground/25 bg-muted text-foreground'
                      : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  <span className="block text-xs font-medium">{opt.label}</span>
                  <span className="block text-[10px] text-muted-foreground/70">{opt.hint}</span>
                </button>
              ))}
            </div>

            {resolution === 'rescheduled' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={rescheduleInput}
                  onChange={(e) => setRescheduleInput(e.target.value)}
                  placeholder="e.g. tomorrow 2pm"
                  className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-foreground transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/30 focus:outline-none"
                />
                <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
                  {parsedReschedule.formattedPreview ?? 'tomorrow'}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
            <button
              type="button"
              onClick={closeAccountabilityModal}
              className="focus-ring rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="focus-ring rounded-xl bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              Log it &amp; move on
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
