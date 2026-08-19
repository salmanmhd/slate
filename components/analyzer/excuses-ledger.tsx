'use client';

import React from 'react';
import { AccountabilityLog, BlockerCategory } from '@/types/matrix';
import { BLOCKER_CATEGORIES } from '@/lib/constants';
import { formatFriendlyDate } from '@/lib/nlp-parser';
import { Search, FileSpreadsheet } from 'lucide-react';

interface ExcusesLedgerProps {
  logs: AccountabilityLog[];
}

export function ExcusesLedger({ logs }: ExcusesLedgerProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.taskTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const exportToCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Task', 'Blocker', 'Reason', 'Resolution', 'Date'];
    const rows = logs.map((log) => [
      `"${log.taskTitle.replace(/"/g, '""')}"`,
      `"${BLOCKER_CATEGORIES[log.category]?.label || log.category}"`,
      `"${log.reason.replace(/"/g, '""')}"`,
      `"${log.resolution}"`,
      `"${log.loggedAt}"`,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `focusmatrix_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (logs.length === 0) {
    return (
      <div className="card-depth rounded-2xl border border-border/80 bg-card p-8 text-center">
        <p className="text-xs text-muted-foreground">No blockers logged</p>
      </div>
    );
  }

  return (
    <div className="card-depth rounded-2xl border border-border/80 bg-card">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-xs font-semibold text-foreground">Blockers</h3>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">{logs.length}</span>
        </div>
        <button
          onClick={exportToCSV}
          className="focus-ring flex items-center gap-1.5 self-start rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <FileSpreadsheet className="size-3" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 border-b border-border/50 px-5 py-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-md border border-border/50 bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/15 focus:outline-none"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-foreground/15 focus:outline-none"
        >
          <option value="all">All categories</option>
          {(Object.keys(BLOCKER_CATEGORIES) as BlockerCategory[]).map((key) => (
            <option key={key} value={key}>{BLOCKER_CATEGORIES[key].label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/40 text-[11px] text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Task</th>
              <th className="px-5 py-3 font-medium">Blocker</th>
              <th className="px-5 py-3 font-medium">Reason</th>
              <th className="px-5 py-3 font-medium">Resolution</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filteredLogs.map((log) => {
              const meta = BLOCKER_CATEGORIES[log.category] || BLOCKER_CATEGORIES.other;
              return (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="max-w-50 truncate px-5 py-3.5 font-medium text-foreground">
                    {log.taskTitle}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                    {meta.label}
                  </td>
                  <td className="max-w-70 px-5 py-3.5 text-muted-foreground">
                    <span className="line-clamp-2">{log.reason}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground capitalize whitespace-nowrap">
                    {log.resolution.replace('_', ' ')}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                    {formatFriendlyDate(log.loggedAt)}
                  </td>
                </tr>
              );
            })}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground/50">
                  No matching entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
