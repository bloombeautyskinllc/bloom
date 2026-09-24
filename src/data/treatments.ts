import facials from '../assets/images/treatment-facials.webp';
import brows from '../assets/images/treatment-brows.webp';
import laser from '../assets/images/treatment-laser.webp';
import intimate from '../assets/images/treatment-intimate.webp';
import menuFacials from '../assets/images/header/facials.webp';
import menuBrows from '../assets/images/header/brows-lips.webp';
import menuLaser from '../assets/images/header/diode-laser.webp';
import menuIntimate from '../assets/images/header/intimate-care.webp';

export type TreatmentCategory = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  image: string;
  /** Photo shown in the header's Treatments menu */
  menuImage: string;
};

export const treatmentCategories: TreatmentCategory[] = [
  {
    slug: 'facials',
    title: 'Facials & Skin Health',
    shortTitle: 'Facials & skin care',
    description:
      'Advanced protocols and clinical-grade technology to restore, oxygenate and revive your complexion.',
    image: facials,
    menuImage: menuFacials,
  },
  {
    slug: 'brows-lips',
    title: 'Brows & Lips',
    shortTitle: 'Brows & lips',
    description:
      'High-precision micropigmentation and lamination that enhance your features, with no daily makeup needed.',
    image: brows,
    menuImage: menuBrows,
  },
  {
    slug: 'diode-laser',
    title: 'Diode Laser Hair Removal',
    shortTitle: 'Diode laser',
    description:
      "Fast, comfortable sessions for smooth, hair-free skin you don't have to think about.",
    image: laser,
    menuImage: menuLaser,
  },
  {
    slug: 'intimate-care',
    title: 'Intimate Skin Care',
    shortTitle: 'Intimate care',
    description:
      'Gentle, discreet protocols that brighten, renew and restore comfort to your most delicate areas.',
    image: intimate,
    menuImage: menuIntimate,
  },
];
