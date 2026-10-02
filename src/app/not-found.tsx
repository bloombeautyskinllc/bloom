import SiteShell from '@/components/layout/SiteShell';
import ComingSoon from '@/views/ComingSoon';

// Unmatched URLs render outside the (marketing) group, so wrap them in the site shell here
export default function NotFound() {
  return (
    <SiteShell>
      <ComingSoon title="Page not found" />
    </SiteShell>
  );
}
