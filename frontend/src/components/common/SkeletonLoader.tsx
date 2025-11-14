interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

/**
 * Base skeleton component for loading states
 */
export function Skeleton({
  className = '',
  width,
  height,
  variant = 'text'
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200';

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

/**
 * Card skeleton for loading dish cards, order cards, etc.
 */
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <Skeleton variant="rectangular" height="12rem" />
      <Skeleton height="1.5rem" width="75%" />
      <Skeleton height="1rem" width="90%" />
      <Skeleton height="1rem" width="60%" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton height="1.5rem" width="30%" />
        <Skeleton variant="rectangular" height="2.5rem" width="5rem" />
      </div>
    </div>
  );
}

/**
 * Table row skeleton for loading tables
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-200">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <Skeleton height="1rem" width={index === 0 ? '60%' : '80%'} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Dashboard stats skeleton
 */
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton height="1rem" width="40%" />
        <Skeleton variant="circular" width="2.5rem" height="2.5rem" />
      </div>
      <Skeleton height="2rem" width="50%" />
      <Skeleton height="0.875rem" width="60%" />
    </div>
  );
}

/**
 * List item skeleton
 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center space-x-4 p-4 border-b border-gray-200">
      <Skeleton variant="circular" width="3rem" height="3rem" />
      <div className="flex-1 space-y-2">
        <Skeleton height="1rem" width="70%" />
        <Skeleton height="0.875rem" width="40%" />
      </div>
      <Skeleton variant="rectangular" height="2rem" width="4rem" />
    </div>
  );
}

/**
 * Page skeleton with header and content
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton height="2rem" width="30%" />
        <Skeleton height="1rem" width="50%" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Content area */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <Skeleton height="1.5rem" width="25%" />
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      </div>
    </div>
  );
}
