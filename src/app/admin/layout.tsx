import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { routes } from '@/data/site';
import { requireStaff } from '@/lib/auth/session';

// Generic title: a 404 for non-staff should not reveal that a back office lives here
export const metadata: Metadata = { title: { default: 'Back office · BLOOM', template: '%s · BLOOM back office' }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireStaff(routes.admin);
  return (
    <AdminShell name={profile.full_name ?? profile.email ?? ''} role={profile.role === 'admin' ? 'admin' : 'staff'}>
      {children}
    </AdminShell>
  );
}
