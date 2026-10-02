import type { ReactNode } from 'react';
import SiteShell from '@/components/layout/SiteShell';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
