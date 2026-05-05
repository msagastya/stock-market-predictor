'use client';

import SearchBar from '@/components/ui/SearchBar';

interface MarketHeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSelectStock: (symbol: string, name: string) => void;
}

export function MarketHeader({ isDarkMode, onToggleTheme, onSelectStock }: MarketHeaderProps) {
  return (
    <header className="glass-strong sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="hidden bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent md:block">
              Stock Analyzer
            </h1>
          </div>
          <div className="max-w-xl flex-1">
            <SearchBar onSelectStock={onSelectStock} />
          </div>
          <button
            onClick={onToggleTheme}
            className="rounded-full p-2 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
            aria-label="Toggle theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}
