import {
  createElement,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/utils';

/**
 * Canonical UI Component Library
 *
 * This barrel is the public design-system contract for web primitives.
 * Screens should import primitives from `@/components/ui`; legacy
 * `components/common/Button` remains deprecated for compatibility only.
 */

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
} from './Card';
export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardBodyProps,
  CardFooterProps,
} from './Card';

export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from './Modal';
export type {
  ModalProps,
  ModalHeaderProps,
  ModalTitleProps,
  ModalDescriptionProps,
  ModalBodyProps,
  ModalFooterProps,
} from './Modal';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './Table';
export type {
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableFooterProps,
  TableRowProps,
  TableHeadProps,
  TableCellProps,
  TableCaptionProps,
} from './Table';

export { ThemeToggle } from './ThemeToggle';
export type { ThemeToggleProps } from './ThemeToggle';

export type UIState = 'default' | 'loading' | 'empty' | 'error' | 'disabled' | 'success' | 'offline' | 'pending';
export type PrimitiveSize = 'sm' | 'md' | 'lg';
export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

const fieldBase =
  'flex min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition-colors duration-base placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, helperText, error, fullWidth, id, children, ...props }, ref) => {
    const selectId = id ?? `select-${String(label ?? 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return createElement(
      'div',
      { className: cn('flex flex-col gap-1.5', fullWidth && 'w-full') },
      label &&
        createElement(
          'label',
          { htmlFor: selectId, className: 'text-sm font-medium text-neutral-700 dark:text-neutral-200' },
          label,
          props.required ? createElement('span', { className: 'ml-1 text-error-600' }, '*') : null
        ),
      createElement(
        'select',
        {
          ref,
          id: selectId,
          'aria-invalid': Boolean(error) || undefined,
          'aria-describedby': error || helperText ? `${selectId}-message` : undefined,
          className: cn(fieldBase, error && 'border-error-600 focus-visible:ring-error-600', className),
          ...props,
        },
        children
      ),
      (error || helperText) &&
        createElement(
          'p',
          {
            id: `${selectId}-message`,
            role: error ? 'alert' : undefined,
            className: cn('text-sm', error ? 'text-error-700' : 'text-neutral-600 dark:text-neutral-300'),
          },
          error ?? helperText
        )
    );
  }
);
Select.displayName = 'Select';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, helperText, error, fullWidth, id, ...props }, ref) => {
    const textareaId = id ?? `textarea-${String(label ?? 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return createElement(
      'div',
      { className: cn('flex flex-col gap-1.5', fullWidth && 'w-full') },
      label &&
        createElement(
          'label',
          { htmlFor: textareaId, className: 'text-sm font-medium text-neutral-700 dark:text-neutral-200' },
          label,
          props.required ? createElement('span', { className: 'ml-1 text-error-600' }, '*') : null
        ),
      createElement('textarea', {
        ref,
        id: textareaId,
        'aria-invalid': Boolean(error) || undefined,
        'aria-describedby': error || helperText ? `${textareaId}-message` : undefined,
        className: cn(fieldBase, 'min-h-28 resize-y', error && 'border-error-600 focus-visible:ring-error-600', className),
        ...props,
      }),
      (error || helperText) &&
        createElement(
          'p',
          {
            id: `${textareaId}-message`,
            role: error ? 'alert' : undefined,
            className: cn('text-sm', error ? 'text-error-700' : 'text-neutral-600 dark:text-neutral-300'),
          },
          error ?? helperText
        )
    );
  }
);
Textarea.displayName = 'Textarea';

export interface FeedbackProps extends HTMLAttributes<HTMLDivElement> {
  tone?: FeedbackTone;
  title?: string;
  action?: ReactNode;
}

export const Feedback = forwardRef<HTMLDivElement, FeedbackProps>(
  ({ className, tone = 'info', title, action, children, ...props }, ref) => {
    const toneClass = {
      info: 'border-info-600 bg-info-50 text-info-700',
      success: 'border-success-700 bg-success-50 text-success-900',
      warning: 'border-warning-700 bg-warning-50 text-neutral-900',
      error: 'border-error-600 bg-error-50 text-error-700',
    }[tone];
    return createElement(
      'div',
      {
        ref,
        role: tone === 'error' ? 'alert' : 'status',
        'aria-live': tone === 'error' ? 'assertive' : 'polite',
        className: cn('rounded-lg border p-4 text-sm', toneClass, className),
        ...props,
      },
      title && createElement('p', { className: 'font-semibold' }, title),
      children && createElement('div', { className: title ? 'mt-1' : undefined }, children),
      action && createElement('div', { className: 'mt-3' }, action)
    );
  }
);
Feedback.displayName = 'Feedback';

export interface StateMessageProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

function stateMessage(role: 'status' | 'alert', className: string) {
  return forwardRef<HTMLDivElement, StateMessageProps>(({ title, description, action, children, ...props }, ref) =>
    createElement(
      'div',
      {
        ref,
        role,
        'aria-live': role === 'alert' ? 'assertive' : 'polite',
        className: cn('rounded-xl border p-6 text-center', className),
        ...props,
      },
      createElement('p', { className: 'text-base font-semibold' }, title),
      description && createElement('p', { className: 'mt-2 text-sm text-neutral-700 dark:text-neutral-200' }, description),
      children,
      action && createElement('div', { className: 'mt-4 flex justify-center' }, action)
    )
  );
}

export const LoadingState = stateMessage('status', 'border-neutral-300 bg-neutral-100 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50');
LoadingState.displayName = 'LoadingState';

export const EmptyState = stateMessage('status', 'border-neutral-300 bg-neutral-50 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50');
EmptyState.displayName = 'EmptyState';

export const ErrorState = stateMessage('alert', 'border-error-600 bg-error-50 text-error-700 dark:bg-error-900 dark:text-error-100');
ErrorState.displayName = 'ErrorState';

export const SuccessState = stateMessage('status', 'border-success-700 bg-success-50 text-success-900 dark:bg-success-900 dark:text-success-100');
SuccessState.displayName = 'SuccessState';

export const designSystemContracts = {
  importAuthority: '@/components/ui',
  deprecatedAuthorities: ['@/components/common/Button'],
  requiredInteractiveSemantics: [
    'keyboard activation',
    'visible focus ring',
    'accessible name',
    'aria-invalid and describedby for field errors',
    'loading announcement',
    'disabled non-submittable behavior',
    'ref forwarding',
  ],
  states: ['default', 'loading', 'empty', 'error', 'disabled', 'success', 'offline', 'pending'] satisfies UIState[],
} as const;
