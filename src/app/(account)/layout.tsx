import type { ReactNode } from 'react';
import SiteShell from '@/components/layout/SiteShell';
import { getContact } from '@/lib/contact';

export default async function AccountLayout({ children }: { children: ReactNode }) {
  return <SiteShell contact={await getContact()}>{children}</SiteShell>;
}
