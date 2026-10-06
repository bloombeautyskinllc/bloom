import SiteShell from '@/components/layout/SiteShell';
import ComingSoon from '@/views/ComingSoon';
import { getContact } from '@/lib/contact';

// Unmatched URLs render outside the (marketing) group, so wrap them in the site shell here
export default async function NotFound() {
  return (
    <SiteShell contact={await getContact()}>
      <ComingSoon title="Page not found" />
    </SiteShell>
  );
}
