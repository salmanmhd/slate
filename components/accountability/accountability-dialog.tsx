'use client';

import React from 'react';
import { useMatrixStore } from '@/lib/store';
import { BLOCKER_CATEGORIES } from '@/lib/constants';
import { BlockerCategory } from '@/types/matrix';
import { Button } from '@/components/ui/button';
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
  Hourglass: <Hourglass className="size-4" />,
  ZapOff: <ZapOff className="size-4" />,
  Maximize2: <Maximize2 className="size-4" />,
  Users: <Users className="size-4" />,
  BatteryLow: <BatteryLow className="size-4" />,
  HelpCircle: <HelpCircle className="size-4" />,
  AlertCircle: <AlertCircle className="size-4" />,
};

export function AccountabilityDialog() {
  const {
    accountabilityModalTask,
    accountabilityModalResolutionDefault,
    closeAccountabilityModal,
    recordAccountability,
  } = useMatrixStore();

  const [category, setCategory] = React.useState<BlockerCategory>('underestimated_time');
  const [reason, setReason] = React.useState('');
  const [resolution, setResolution] = React.useState<'rescheduled' | 'eliminated' | 'marked_failed'>(
    accountabilityModalResolutionDefault || 'rescheduled'
  );
  const [rescheduleInput, setRescheduleInput] = React.useState('tomorrow 5pm');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (accountabilityModalTask) {
      setReason(accountabilityModalTask.failureReason || '');
      setCategory(accountabilityModalTask.blockerCategory || 'underestimated_time');
      setResolution(accountabilityModalResolutionDefault || 'rescheduled');
      setError('');
    }
  }, [accountabilityModalTask, accountabilityModalResolutionDefault]);

  if (!accountabilityModalTask) return null;

  const parsedReschedule = parseTaskInput(rescheduleInput);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (reason.trim().length < 8) {
      setError('Write at least a short explanation (8+ characters).');
      return;
    }

    let newDueDateStr: string | null = null;
    if (resolution === 'rescheduled') {
      newDueDateStr = parsedReschedule.parsedDate
        ? parsedReschedule.parsedDate.toISOString()
        : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    }

    recordAccountability(
      accountabilityModalTask.id,
      category,
      reason.trim(),
      resolution,
      newDueDateStr
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/70 backdrop-blur-sm" onClick={closeAccountabilityModal} />

      <div className="relative w-full max-w-lg rounded-xl border border-border/70 bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              What blocked this?
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-sm">
              "{accountabilityModalTask.content}"
              {accountabilityModalTask.parsedDate && (
                <span className="text-rose-500"> — was due {formatFriendlyDate(accountabilityModalTask.parsedDate)}</span>
              )}
            </p>
          </div>
          <button
            onClick={closeAccountabilityModal}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Blocker category — compact grid */}
          <div>
            <label className="text-xs font-medium text-foreground">Root cause</label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(Object.keys(BLOCKER_CATEGORIES) as BlockerCategory[]).map((key) => {
                const meta = BLOCKER_CATEGORIES[key];
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-foreground/20 bg-muted text-foreground'
                        : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    {iconMap[meta.icon]}
                    <span className="font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="accountability-reason-input" className="text-xs font-medium text-foreground">
              What happened, honestly?
            </label>
            <textarea
              id="accountability-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="Be specific. This is for you, not anyone else."
              className="mt-1.5 w-full rounded-lg border border-border/60 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/20 focus:outline-none resize-none"
            />
            {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
          </div>

          {/* Resolution */}
          <div>
            <label className="text-xs font-medium text-foreground">What now?</label>
            <div className="mt-2 flex gap-1.5">
              {[
                { id: 'rescheduled', label: 'Reschedule' },
                { id: 'eliminated', label: 'Drop it' },
                { id: 'marked_failed', label: 'Mark failed' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setResolution(opt.id as typeof resolution)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors flex-1 ${
                    resolution === opt.id
                      ? 'border-foreground/20 bg-muted text-foreground'
                      : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {resolution === 'rescheduled' && (
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="text"
                  value={rescheduleInput}
                  onChange={(e) => setRescheduleInput(e.target.value)}
                  placeholder="e.g. tomorrow 2pm"
                  className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/20 focus:outline-none"
                />
                {parsedReschedule.formattedPreview && (
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    → {parsedReschedule.formattedPreview}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" size="sm" onClick={closeAccountabilityModal}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Log & continue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
