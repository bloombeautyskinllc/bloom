import { redirect } from 'next/navigation';
import { routes } from '@/data/site';

// The intake & consent form is signed online as a step of every booking
export default function Page() {
  redirect(routes.booking);
}
