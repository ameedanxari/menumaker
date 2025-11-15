import { forwardRef, HTMLAttributes, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

/**
 * Modal Component
 * Phase 3: Design System & Theming (US3.12)
 *
 * A modal dialog component with backdrop, animations, and keyboard navigation.
 *
 * @example
 * <Modal open={isOpen} onClose={() => setIsOpen(false)} size="md">
 *   <ModalHeader>
 *     <ModalTitle>Modal Title</ModalTitle>
 *     <ModalDescription>Modal description</ModalDescription>
 *   </ModalHeader>
 *   <ModalBody>
 *     Modal content goes here
 *   </ModalBody>
 *   <ModalFooter>
 *     <Button onClick={onClose}>Cancel</Button>
 *     <Button variant="primary">Confirm</Button>
 *   </ModalFooter>
 * </Modal>
 */

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  /** Whether modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose?: () => void;
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether clicking backdrop closes modal */
  closeOnBackdropClick?: boolean;
  /** Whether ESC key closes modal */
  closeOnEscape?: boolean;
  /** Whether to show close button */
  showCloseButton?: boolean;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      className,
      open,
      onClose,
      size = 'md',
      closeOnBackdropClick = true,
      closeOnEscape = true,
      showCloseButton = true,
      children,
      ...props
    },
    ref
  ) => {
    // Handle ESC key
    useEffect(() => {
      if (!closeOnEscape || !open) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose?.();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open, closeOnEscape, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }

      return () => {
        document.body.style.overflow = 'unset';
      };
    }, [open]);

    if (!open) return null;

    const sizeStyles = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      full: 'max-w-full m-4',
    };

    const modalContent = (
      <div
        className="fixed inset-0 z-modalBackdrop flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && closeOnBackdropClick) {
            onClose?.();
          }
        }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity duration-base dark:bg-neutral-950/70"
          aria-hidden="true"
        />

        {/* Modal */}
        <div
          ref={ref}
          className={cn(
            'relative z-modal w-full rounded-lg bg-white shadow-2xl transition-all duration-base dark:bg-neutral-900',
            sizeStyles[size],
            'animate-in fade-in-0 zoom-in-95',
            className
          )}
          role="dialog"
          aria-modal="true"
          {...props}
        >
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Close modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {children}
        </div>
      </div>
    );

    // Render modal in portal (at document.body)
    return createPortal(modalContent, document.body);
  }
);

Modal.displayName = 'Modal';

// Modal Header
export interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-6 pb-4', className)}
        {...props}
      />
    );
  }
);

ModalHeader.displayName = 'ModalHeader';

// Modal Title
export interface ModalTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const ModalTitle = forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={cn(
          'text-xl font-semibold leading-none tracking-tight text-neutral-900 dark:text-neutral-100',
          className
        )}
        {...props}
      />
    );
  }
);

ModalTitle.displayName = 'ModalTitle';

// Modal Description
export interface ModalDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const ModalDescription = forwardRef<HTMLParagraphElement, ModalDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-neutral-500 dark:text-neutral-400', className)}
        {...props}
      />
    );
  }
);

ModalDescription.displayName = 'ModalDescription';

// Modal Body
export interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {}

export const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-6 py-4', className)}
        {...props}
      />
    );
  }
);

ModalBody.displayName = 'ModalBody';

// Modal Footer
export interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-row items-center justify-end gap-2 p-6 pt-4',
          className
        )}
        {...props}
      />
    );
  }
);

ModalFooter.displayName = 'ModalFooter';
