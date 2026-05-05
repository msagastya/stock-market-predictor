'use client';

import { TradingTip } from '@/types';

interface TipsSectionProps {
  tips: TradingTip[];
}

export function TipsSection({ tips }: TipsSectionProps) {
  if (tips.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="mb-4 text-xl font-bold">Smart Trading Tips</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tips.map((tip) => (
          <div key={tip.id} className="glass rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <h4 className="mb-1 font-semibold text-blue-600 dark:text-blue-400">{tip.title}</h4>
            <p className="text-sm text-muted-foreground">{tip.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
