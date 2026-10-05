import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import AdminShell from '@/components/admin/AdminShell';
import { routes } from '@/data/site';
import { requireStaff } from '@/lib/auth/session';

// Generic title: a 404 for non-staff should not reveal that a back office lives here
export const metadata: Metadata = { title: { default: 'Back office · BLOOM', template: '%s · BLOOM back office' }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [{ profile }, messages] = await Promise.all([requireStaff(routes.admin), getMessages()]);
  return (
    // Back office client components only read "bo", which the root layout leaves out for public pages
    <NextIntlClientProvider messages={{ bo: messages.bo }}>
      <AdminShell name={profile.full_name ?? profile.email ?? ''} role={profile.role === 'admin' ? 'admin' : 'staff'}>
        {children}
      </AdminShell>
    </NextIntlClientProvider>
  );
}
