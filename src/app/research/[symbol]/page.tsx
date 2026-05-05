import { ResearchWorkspace } from '@/features/research/components/ResearchWorkspace';

export default function ResearchPage({
  params,
  searchParams,
}: {
  params: { symbol: string };
  searchParams?: { name?: string };
}) {
  const symbol = decodeURIComponent(params.symbol);
  const name = searchParams?.name ? decodeURIComponent(searchParams.name) : symbol;

  return <ResearchWorkspace symbol={symbol} name={name} />;
}
