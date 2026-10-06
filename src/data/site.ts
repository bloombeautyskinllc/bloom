// Global business info shown on the public site (footer, contact links, WhatsApp button)
export const site = {
  name: 'BLOOM Beauty Skin',
  address: {
    line1: '305 E 204th St, Suite 2A',
    line2: 'Bronx, NY 10467',
    mapsUrl: 'https://maps.google.com/?q=305+E+204th+St+Bronx+NY+10467',
  },
  phone: '+1 (347) 483-3337',
  phoneHref: 'tel:+13474833337',
  email: 'bloombeautyskinllc@gmail.com',
  whatsappUrl: 'https://wa.me/13474833337',
  social: {
    instagram: 'https://instagram.com/',
    facebook: 'https://facebook.com/',
    tiktok: 'https://tiktok.com/',
  },
  // Same as the opening hours in the back office (Team & hours)
  hours: [
    { days: 'Mon – Fri', time: '10:00 – 18:00' },
    { days: 'Sat', time: '10:00 – 15:00' },
  ],
  rating: '4.9/5',
  treatmentsPerformed: '1,200+',
} as const;

export const routes = {
  home: '/',
  booking: '/booking',
  privacy: '/privacy',
  terms: '/terms',
  intakeForm: '/intake-form',
  dashboard: '/dashboard',
  admin: '/admin',
  authCallback: '/auth/callback',
  treatment: (slug: string) => `/treatments/${slug}`,
} as const;

export const navLinks = [
  { label: 'About', href: '/#about' },
  { label: 'The method', href: '/#method' },
  { label: 'Skin consultation', href: '/#consultation' },
] as const;
