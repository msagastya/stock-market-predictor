import { AutomatedAnalysis, CompanyCalendar, CompanyProfile, Recommendation, StockFundamentals, TechnicalIndicators, TradingTip, OHLCV } from '@/types';
import { SupportResistanceLevel } from '@/lib/analysis/support-resistance';
import { ChartOverlays, ChartType } from '@/components/charts/StockChart';

export interface SelectedStock {
  symbol: string;
  name: string;
}

export interface MarketDashboardState {
  ohlcvData: OHLCV[];
  indicators: TechnicalIndicators | null;
  recommendation: Recommendation | null;
  automatedAnalysis: AutomatedAnalysis | null;
  supportResistance: SupportResistanceLevel[];
  volumeInsights: string[];
  selectedStock: SelectedStock;
  isLoading: boolean;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  fundamentals: StockFundamentals | null;
  profile: CompanyProfile | null;
  calendar: CompanyCalendar | null;
  currency: string;
  lastUpdated: Date | null;
  chartType: ChartType;
  overlays: ChartOverlays;
  showFibonacci: boolean;
  timeframe: string;
  activeTab: 'analysis' | 'fundamentals' | 'news';
  isDarkMode: boolean;
  relevantTips: TradingTip[];
  errorMessage: string | null;
  dataWarning?: string | null;
}
