'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { HiX } from 'react-icons/hi';
import { setScrollLocked } from '@/lib/smoothScroll';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  closeLabel?: string;
  wide?: boolean;
};

/** Accessible dialog in the site style: bottom sheet on phones, centered card from sm up. */
export default function Modal({ open, onOpenChange, title, description, children, closeLabel = 'Close', wide = false }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScrollLocked(open);
    return () => setScrollLocked(false);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] animate-page-in bg-ink/55 backdrop-blur-[3px]" />
        <div className="pointer-events-none fixed inset-0 z-[101] flex items-end justify-center sm:items-center sm:p-6">
          <Dialog.Content
            ref={contentRef}
            tabIndex={-1}
            data-lenis-prevent
            // Focus the dialog itself: focusing a field would open the keyboard over the sheet on phones
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              contentRef.current?.focus();
            }}
            className={cn(
              'pointer-events-auto relative max-h-[92dvh] w-full animate-enter-up overflow-y-auto overscroll-contain rounded-t-[26px] bg-cream px-5 pb-8 pt-6 shadow-soft focus:outline-none sm:rounded-[26px] sm:px-10 sm:pb-10 sm:pt-9',
              wide ? 'sm:max-w-[860px]' : 'sm:max-w-[480px]',
            )}
          >
            <span aria-hidden className="mx-auto mb-5 block h-1 w-10 rounded-full bg-taupe sm:hidden" />
            <Dialog.Close
              aria-label={closeLabel}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-sand hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:right-5 sm:top-5"
            >
              <HiX className="h-5 w-5" />
            </Dialog.Close>
            <Dialog.Title className="pr-10 font-serif text-[28px] leading-tight text-ink">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-2 text-[15px] leading-relaxed text-muted">{description}</Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
            <div className="mt-6">{children}</div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
