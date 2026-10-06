'use client';

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import type { Contact } from '@/lib/contact';
import { site } from '@/data/site';

// Default for trees rendered without the provider; the site shell always passes the admin values
const ContactContext = createContext<Contact>({
  phone: site.phone,
  phoneHref: site.phoneHref,
  whatsappUrl: site.whatsappUrl,
  email: site.email,
  address: site.address,
});

/** Shares the contact details from admin > Settings with every component on the page */
export default function ContactProvider({ contact, children }: { contact: Contact; children: ReactNode }) {
  return <ContactContext.Provider value={contact}>{children}</ContactContext.Provider>;
}

export const useContact = () => useContext(ContactContext);

/** Link to the studio's WhatsApp chat (number from admin > Settings), usable from server components */
export function WhatsAppLink(props: Omit<ComponentProps<'a'>, 'href' | 'target' | 'rel'>) {
  return <a {...props} href={useContact().whatsappUrl} target="_blank" rel="noreferrer" />;
}
