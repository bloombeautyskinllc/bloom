'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addBookingNote, addClientNote } from '@/lib/admin/actions';
import { buttonClass, inputClass } from './ui';

/** Add an internal note to a booking or a client */
export default function NoteForm({ kind, targetId, placeholder, label }: { kind: 'booking' | 'client'; targetId: string; placeholder: string; label: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          const result = await (kind === 'booking' ? addBookingNote : addClientNote)({ targetId, body });
          if (result.ok) {
            setBody('');
            router.refresh();
          }
        });
      }}
    >
      <textarea rows={2} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={`${inputClass} h-auto py-2`} />
      <button type="submit" disabled={pending || !body.trim()} className={`${buttonClass.secondary} self-end`}>
        {label}
      </button>
    </form>
  );
}
