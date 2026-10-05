import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-[length:200%_100%]',
        className
      )}
    />
  );
};

export const OverviewSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export const TracesTableSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-slate-800 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-14 h-6 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="w-48 h-4" />
              <Skeleton className="w-32 h-3" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-16 h-4" />
            <Skeleton className="w-20 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
};
