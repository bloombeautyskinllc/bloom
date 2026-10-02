'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setBookingStatus } from '@/lib/admin/actions';
import { buttonClass } from './ui';

/** One-click closing of a past appointment: completed or no-show */
export default function BookingQuickActions({ bookingId }: { bookingId: string }) {
  const t = useTranslations('bo.booking');
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (status: 'completed' | 'no_show') =>
    start(async () => {
      const result = await setBookingStatus({ bookingId, status });
      if (result.ok) router.refresh();
    });

  return (
    <span className="flex gap-1.5">
      <button type="button" disabled={pending} onClick={() => set('completed')} className={`${buttonClass.secondary} px-3 py-1.5 text-xs`}>
        {t('complete')}
      </button>
      <button type="button" disabled={pending} onClick={() => set('no_show')} className={`${buttonClass.ghost} px-3 py-1.5 text-xs`}>
        {t('noShow')}
      </button>
    </span>
  );
}
