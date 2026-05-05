'use client';

interface HeroMetric {
  label: string;
  value: string;
}

export function PageHero({
  eyebrow,
  title,
  description,
  metrics = [],
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: HeroMetric[];
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.92))] p-8 shadow-2xl shadow-black/20 backdrop-blur md:p-10">
      <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(148,163,184,0.14),_transparent_62%)] lg:block" />

      <div className="relative grid gap-8 xl:grid-cols-[1.35fr_0.9fr]">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-blue-300">{eyebrow}</div>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{description}</p>
        </div>

        {metrics.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{metric.label}</div>
                <div className="mt-2 text-xl font-semibold text-white">{metric.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
