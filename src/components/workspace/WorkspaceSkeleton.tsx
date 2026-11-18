import React from "react";

type SkeletonVariant = "inbox" | "dashboard" | "board" | "team" | "generic";

function SidebarSkeleton() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-3.5">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-2.5 w-32 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-3 border-b border-slate-100 pb-3">
        <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="mt-4 flex-1 space-y-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="h-14 w-full animate-pulse rounded-xl bg-slate-100" />
    </aside>
  );
}

function TopNavbarSkeleton() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
      <div className="h-9 w-full max-w-md animate-pulse rounded-xl bg-slate-100" />
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
          <div className="hidden space-y-1 sm:block">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    </header>
  );
}

function InboxContentSkeleton() {
  return (
    <div className="flex h-full flex-row overflow-hidden">
      <div className="hidden w-[340px] shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
        <div className="flex items-center justify-between">
          <div className="h-6 w-28 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-8 w-28 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div className="mt-3 h-9 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col bg-slate-50/70">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-6">
          <div className="h-16 w-72 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="ml-auto h-16 w-80 animate-pulse rounded-2xl bg-emerald-100/70" />
          <div className="h-20 w-96 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      </div>
    </div>
  );
}

function DashboardContentSkeleton() {
  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50/70 p-6">
      <div className="space-y-1.5">
        <div className="h-6 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-3.5 w-80 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    </div>
  );
}

function BoardContentSkeleton() {
  return (
    <div className="h-full overflow-hidden bg-slate-50/70 p-6">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="mt-6 flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="w-72 shrink-0 space-y-3">
            <div className="h-8 w-full animate-pulse rounded-xl bg-slate-200" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamContentSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 p-6">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-5">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-3.5 w-80 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
        </div>

        <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-3.5 w-32 rounded bg-slate-200" />
              <div className="mt-4 h-7 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="h-10 w-full max-w-sm animate-pulse rounded-xl bg-slate-100" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>

          <div className="grid shrink-0 grid-cols-7 gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className="h-3 w-16 animate-pulse rounded bg-slate-200" />
            ))}
          </div>

          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-hidden">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-44 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
                <div className="h-7 w-28 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
                <div className="h-7 w-20 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-4 w-8 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-12 animate-pulse rounded bg-slate-100" />
                <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>

          <div className="mt-auto flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
            <div className="h-3.5 w-48 animate-pulse rounded bg-slate-200" />
            <div className="flex gap-1.5">
              <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GenericContentSkeleton() {
  return (
    <div className="thin-scrollbar h-full overflow-y-auto bg-slate-50/70 p-6">
      <div className="space-y-1.5">
        <div className="h-6 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-3.5 w-80 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mt-6 space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    </div>
  );
}

const CONTENT: Record<SkeletonVariant, React.ComponentType> = {
  inbox: InboxContentSkeleton,
  dashboard: DashboardContentSkeleton,
  board: BoardContentSkeleton,
  team: TeamContentSkeleton,
  generic: GenericContentSkeleton,
};

/** Skeleton da aplicação com a área principal adequada à rota atual. */
export function WorkspaceSkeleton({ variant = "dashboard" }: { variant?: SkeletonVariant }) {
  const Content = CONTENT[variant];
  return (
    <div className="flex h-screen flex-row overflow-hidden bg-slate-50">
      <SidebarSkeleton />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbarSkeleton />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Content />
        </main>
      </div>
    </div>
  );
}

/** Mapeia um pathname para a variante de skeleton mais próxima. */
export function skeletonVariantForPath(pathname: string): SkeletonVariant {
  if (pathname.startsWith("/inbox")) return "inbox";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/funil")) return "board";
  if (pathname.startsWith("/equipe")) return "team";
  return "generic";
}
