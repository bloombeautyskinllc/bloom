import type { ReactNode } from 'react';
import SiteShell from '@/components/layout/SiteShell';
import { getContact } from '@/lib/contact';

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  return <SiteShell contact={await getContact()}>{children}</SiteShell>;
}
