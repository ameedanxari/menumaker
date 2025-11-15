import { forwardRef, HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * Table Component
 * Phase 3: Design System & Theming (US3.12)
 *
 * A responsive table component with sorting, striping, and hover states.
 *
 * @example
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>Name</TableHead>
 *       <TableHead>Email</TableHead>
 *       <TableHead className="text-right">Actions</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>John Doe</TableCell>
 *       <TableCell>john@example.com</TableCell>
 *       <TableCell className="text-right">
 *         <Button size="sm">Edit</Button>
 *       </TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Whether table has striped rows */
  striped?: boolean;
  /** Whether rows have hover effect */
  hoverable?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, striped = false, hoverable = true, ...props }, ref) => {
    return (
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn(
            'w-full caption-bottom text-sm',
            striped && 'table-striped',
            hoverable && 'table-hoverable',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Table.displayName = 'Table';

// Table Header
export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}

export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={cn(
          'border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900',
          className
        )}
        {...props}
      />
    );
  }
);

TableHeader.displayName = 'TableHeader';

// Table Body
export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={cn('[&_tr:last-child]:border-0', className)}
        {...props}
      />
    );
  }
);

TableBody.displayName = 'TableBody';

// Table Footer
export interface TableFooterProps extends HTMLAttributes<HTMLTableSectionElement> {}

export const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <tfoot
        ref={ref}
        className={cn(
          'border-t border-neutral-200 bg-neutral-50 font-medium dark:border-neutral-800 dark:bg-neutral-900',
          className
        )}
        {...props}
      />
    );
  }
);

TableFooter.displayName = 'TableFooter';

// Table Row
export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn(
          'border-b border-neutral-200 transition-colors dark:border-neutral-800',
          'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
          className
        )}
        {...props}
      />
    );
  }
);

TableRow.displayName = 'TableRow';

// Table Head
export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Whether column is sortable */
  sortable?: boolean;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc' | null;
  /** Callback when sort is clicked */
  onSort?: () => void;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable = false, sortDirection = null, onSort, children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn(
          'h-12 px-4 text-left align-middle font-medium text-neutral-500 dark:text-neutral-400',
          sortable && 'cursor-pointer select-none hover:text-neutral-700 dark:hover:text-neutral-200',
          className
        )}
        onClick={sortable ? onSort : undefined}
        {...props}
      >
        {sortable ? (
          <div className="flex items-center gap-2">
            {children}
            {sortDirection && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  'transition-transform',
                  sortDirection === 'desc' && 'rotate-180'
                )}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            )}
          </div>
        ) : (
          children
        )}
      </th>
    );
  }
);

TableHead.displayName = 'TableHead';

// Table Cell
export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={cn(
          'p-4 align-middle text-neutral-900 dark:text-neutral-100',
          className
        )}
        {...props}
      />
    );
  }
);

TableCell.displayName = 'TableCell';

// Table Caption
export interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {}

export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <caption
        ref={ref}
        className={cn(
          'mt-4 text-sm text-neutral-500 dark:text-neutral-400',
          className
        )}
        {...props}
      />
    );
  }
);

TableCaption.displayName = 'TableCaption';
