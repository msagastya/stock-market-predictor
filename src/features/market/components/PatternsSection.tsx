'use client';

import { Recommendation } from '@/types';

interface PatternsSectionProps {
  recommendation: Recommendation | null;
}

export function PatternsSection({ recommendation }: PatternsSectionProps) {
  if (!recommendation || recommendation.patterns.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="mb-4 text-xl font-bold">Detected Patterns</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {recommendation.patterns.map((pattern, index) => (
          <div
            key={`${pattern.name}-${index}`}
            className={`glass rounded-lg border-l-4 p-4 ${
              pattern.type === 'bullish'
                ? 'border-green-500'
                : pattern.type === 'bearish'
                  ? 'border-red-500'
                  : 'border-gray-500'
            }`}
          >
            <div className="mb-2 flex items-start justify-between">
              <h4 className="font-bold">{pattern.name}</h4>
              <span className="rounded bg-black/10 px-2 py-1 text-xs capitalize dark:bg-white/10">
                {pattern.confidence}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{pattern.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
