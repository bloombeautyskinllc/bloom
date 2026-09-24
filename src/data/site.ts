// Global business info. Placeholder values come straight from the Figma design:
// replace phone, email and WhatsApp number with the real ones before launch.
export const site = {
  name: 'BLOOM Beauty Skin',
  address: {
    line1: '305 E 204th St, Suite 2A',
    line2: 'Bronx, NY 10467',
    mapsUrl: 'https://maps.google.com/?q=305+E+204th+St+Bronx+NY+10467',
  },
  phone: '+1 (123) 123-456',
  phoneHref: 'tel:+1123123456',
  email: 'bloombeauty@gmail.com',
  whatsappUrl: 'https://wa.me/1123123456',
  social: {
    instagram: 'https://instagram.com/',
    facebook: 'https://facebook.com/',
    tiktok: 'https://tiktok.com/',
  },
  hours: { days: 'Open Monday to Saturday', time: '10:00 – 20:00' },
  rating: '4.9/5',
  treatmentsPerformed: '1,200+',
} as const;

export const routes = {
  home: '/',
  booking: '/booking',
  privacy: '/privacy',
  terms: '/terms',
  intakeForm: '/intake-form',
  treatmentPattern: '/treatments/:slug',
  treatment: (slug: string) => `/treatments/${slug}`,
} as const;

export const navLinks = [
  { label: 'The method', href: '/#method' },
  { label: 'About', href: '/#about' },
  { label: 'Skin consultation', href: routes.booking },
] as const;
