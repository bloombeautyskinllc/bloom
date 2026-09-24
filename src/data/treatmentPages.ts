import type { IconType } from 'react-icons';
import {
  PiCalendarBlankLight,
  PiClockLight,
  PiDropLight,
  PiFlowerLotusLight,
  PiHandHeartLight,
  PiHeartLight,
  PiLeafLight,
  PiLockSimpleLight,
  PiMagnifyingGlassLight,
  PiPaletteLight,
  PiPencilSimpleLight,
  PiShieldCheckLight,
  PiSlidersHorizontalLight,
  PiSparkleLight,
  PiStackLight,
} from 'react-icons/pi';
import { BrowLipsIcon } from '../components/ui/icons';
import facialsHero from '../assets/images/treatment-facials.webp';
import facialsMenu from '../assets/images/treatments/facials-menu.webp';
import facialsExperience from '../assets/images/treatments/facials-experience.webp';
import browsHero from '../assets/images/treatment-brows.webp';
import browsMenu from '../assets/images/treatments/brows-menu.webp';
import browsExperience from '../assets/images/treatments/brows-experience.webp';
import laserHero from '../assets/images/treatment-laser.webp';
import laserMenu from '../assets/images/treatments/laser-menu.webp';
import laserExperience from '../assets/images/treatments/laser-experience.webp';
import intimateHero from '../assets/images/treatment-intimate.webp';
import intimateMenu from '../assets/images/treatments/intimate-menu.webp';
import intimateExperience from '../assets/images/treatments/intimate-experience.webp';

/** A heading with an italic serif accent at the end: "<lead> <em>accent</em>" */
export type SplitHeading = { lead: string; accent: string };

export type Feature = { icon: IconType; title: string; body: string };

export type MenuItem = { name: string; price: string; description?: string; bestSeller?: boolean };

/** A block of the price menu, optionally titled (e.g. "Brows", "Lips") */
export type MenuGroup = { label?: string; items: MenuItem[] };

export type TreatmentPage = {
  /** Matches a slug in treatmentCategories */
  slug: string;
  hero: {
    title: SplitHeading;
    subtitle: string;
    image: string;
    imageAlt: string;
    /** Tailwind object-position class to frame the photo, e.g. 'object-[center_40%]' */
    imagePosition?: string;
  };
  why: { heading: SplitHeading; body: string; points: Feature[] };
  menu: { heading: SplitHeading; groups: MenuGroup[]; note: string; image: string; imageAlt: string };
  benefits: string[];
  experience: {
    heading: SplitHeading;
    body: string;
    image: string;
    imageAlt: string;
    features: Feature[];
    question: string;
  };
};

export const treatmentPages: TreatmentPage[] = [
  {
    slug: 'facials',
    hero: {
      title: { lead: 'Facials &', accent: 'Skin Care' },
      subtitle: 'Clinical protocols designed to restore, renew and bring back your skin’s natural glow.',
      image: facialsHero,
      imageAlt: 'Client relaxing during a facial massage in a softly lit treatment suite',
    },
    why: {
      heading: { lead: 'A more intentional approach to', accent: 'facial care.' },
      body: 'Every facial at BLOOM starts with a skin diagnosis. We combine advanced technology, clinical-grade cosmeceuticals and one-on-one care to treat what your skin needs today, not what’s trending.',
      points: [
        {
          icon: PiMagnifyingGlassLight,
          title: 'Diagnosis before treatment',
          body: 'We assess texture, hydration, pigmentation and sensitivity before choosing your protocol, so every step has a purpose.',
        },
        {
          icon: PiShieldCheckLight,
          title: 'Barrier-first results',
          body: 'Actives are dosed to deliver visible change while protecting your skin barrier before, during and after each session.',
        },
      ],
    },
    menu: {
      heading: { lead: 'Our facial &', accent: 'skin care menu' },
      groups: [
        {
          items: [
            { name: 'Microneedling', price: '$250', bestSeller: true },
            { name: 'Face Peeling (Mesopeel)', price: '$240' },
            { name: 'Hydrodermabrasion Treatment', price: '$180', bestSeller: true },
            { name: 'Hydrating Facial', price: '$180' },
            { name: 'Back Facial', price: '$180' },
            { name: 'Dermaplaning Treatment', price: '$175', bestSeller: true },
            { name: 'Autumn Glow Facial', price: '$175' },
            { name: 'Oxygen Infusion Facial', price: '$170' },
            { name: 'Pumpkin Peel Facial (Vitamin A)', price: '$160' },
            { name: 'Vitamin C Facial', price: '$150' },
            { name: 'Microdermabrasion Treatment', price: '$140' },
            { name: 'Skin Revival Facial', price: '$135' },
            { name: 'My Signature Facial', price: '$120+' },
          ],
        },
      ],
      note: 'Prices marked “+” are starting prices. Your final protocol is confirmed at your consultation.',
      image: facialsMenu,
      imageAlt: 'Cosmetologist performing a hydrodermabrasion treatment on a smiling client',
    },
    benefits: ['Deep hydration', 'Collagen renewal', 'Even tone', 'Refined pores', 'Natural glow', 'Smooth texture'],
    experience: {
      heading: { lead: 'A more intentional path to', accent: 'healthy, radiant skin.' },
      body: 'Every protocol combines precision, comfort and science to deliver results that look natural and last.',
      image: facialsExperience,
      imageAlt: 'Client with a clay mask and eye pads during a facial with steam',
      features: [
        {
          icon: PiStackLight,
          title: 'Advanced technology',
          body: 'Microneedling, hydrodermabrasion and oxygen infusion, selected for what your skin needs.',
        },
        {
          icon: PiSparkleLight,
          title: 'Clinical-grade actives',
          body: 'Professional peels and serums chosen with intention, never one-size-fits-all.',
        },
        {
          icon: PiCalendarBlankLight,
          title: 'A plan, not a single visit',
          body: 'You leave with an at-home routine that protects and extends your results.',
        },
      ],
      question: 'Not sure which facial is right for you?',
    },
  },
  {
    slug: 'brows-lips',
    hero: {
      title: { lead: 'Brows &', accent: 'Lips' },
      subtitle: 'High-precision micropigmentation and lamination that enhance your natural features.',
      image: browsHero,
      imageAlt: 'Portrait of a woman with defined brows and soft, natural lip color',
      imagePosition: 'object-[center_38%]',
    },
    why: {
      heading: { lead: 'A more intentional approach to', accent: 'brows and lips.' },
      body: 'Every design begins with your face: its proportions, your features and your skin tone. We map, measure and custom-match color before a single stroke, so the result looks like you, only more defined.',
      points: [
        {
          icon: PiPencilSimpleLight,
          title: 'Custom brow mapping',
          body: 'Shape and symmetry designed around your bone structure and natural expressions.',
        },
        {
          icon: PiPaletteLight,
          title: 'Color matched to you',
          body: 'Pigments selected for your undertone, so results heal soft and natural.',
        },
      ],
    },
    menu: {
      heading: { lead: 'Our brow &', accent: 'lip menu' },
      groups: [
        {
          label: 'Brows',
          items: [
            {
              name: 'Shadow Brows',
              price: '$600',
              bestSeller: true,
              description: 'A soft, powdered finish for a defined, filled-in look.',
            },
            { name: 'European Brows', price: '$600', description: 'Fine hair strokes that recreate natural brow hairs.' },
            {
              name: 'Laminated Brows',
              price: '$110',
              description: 'Lifts and sets your natural brows for a brushed-up look.',
            },
          ],
        },
        {
          label: 'Lips',
          items: [
            {
              name: 'Watercolor Lips',
              price: '$500',
              description: 'Sheer, blended color that enhances your natural tone.',
            },
            { name: 'Full Lips', price: '$600', description: 'Full, defined color with a perfected lip line.' },
            {
              name: 'Korean Lips',
              price: '$490',
              description: 'A soft gradient, deeper at the center, for a fresh look.',
            },
          ],
        },
      ],
      note: 'Touch-up recommendations are discussed during your consultation.',
      image: browsMenu,
      imageAlt: 'Specialist applying lip micropigmentation to a relaxed client',
    },
    benefits: ['Brow definition', 'Natural color', 'Symmetry', 'Soft lip tint', 'Wake-up ready', 'Precision'],
    experience: {
      heading: { lead: 'Precision that looks', accent: 'effortlessly natural.' },
      body: 'Every technique is chosen for your face, your skin and the result you want to see in the mirror.',
      image: browsExperience,
      imageAlt: 'Specialist mapping a client’s brows before micropigmentation',
      features: [
        {
          icon: BrowLipsIcon,
          title: 'Precision design',
          body: 'Measured mapping and pre-drawing, approved by you before we begin.',
        },
        {
          icon: PiSlidersHorizontalLight,
          title: 'The right technique',
          body: 'Shadow, European hair-strokes, watercolor or Korean gradient, matched to your goals.',
        },
        {
          icon: PiHeartLight,
          title: 'Healing guidance',
          body: 'Clear aftercare instructions so your results heal beautifully.',
        },
      ],
      question: 'Not sure which technique suits you?',
    },
  },
  {
    slug: 'diode-laser',
    hero: {
      title: { lead: 'Diode Laser', accent: 'Hair Removal' },
      subtitle: 'Fast, comfortable sessions for smooth skin you don’t have to think about.',
      image: laserHero,
      imageAlt: 'Specialist performing a diode laser session on a client’s leg',
      imagePosition: 'object-[center_45%]',
    },
    why: {
      heading: { lead: 'A more intentional approach to', accent: 'hair removal.' },
      body: 'We adjust every session to your skin tone and hair type, using diode laser technology designed for comfort and consistent results across a wide range of skin tones.',
      points: [
        {
          icon: PiSlidersHorizontalLight,
          title: 'Settings tailored to you',
          body: 'Energy and pulse are adjusted to your skin and hair type at every visit.',
        },
        {
          icon: PiHandHeartLight,
          title: 'Comfort in every session',
          body: 'Cooling technology and a calm, private suite keep each session comfortable.',
        },
      ],
    },
    menu: {
      heading: { lead: 'Laser pricing,', accent: 'per session' },
      groups: [
        {
          label: 'Face',
          items: [
            { name: 'Upper Lip', price: '$40+' },
            { name: 'Chin', price: '$45+' },
            { name: 'Sideburns', price: '$45+' },
            { name: 'Full Face', price: '$50+' },
            { name: 'Neck', price: '$60+' },
            { name: 'Beard', price: '$80+' },
          ],
        },
        {
          label: 'Body',
          items: [
            { name: 'Half Leg', price: '$50+' },
            { name: 'Underarms', price: '$55+' },
            { name: 'Full Arm', price: '$55+' },
            { name: 'Bikini', price: '$60+' },
            { name: 'Upper Chest', price: '$70+' },
            { name: 'Full Leg', price: '$80+' },
            { name: 'Back', price: '$100+' },
          ],
        },
      ],
      note: 'Laser works best as a series of sessions. We’ll recommend the right number for your skin and hair type.',
      image: laserMenu,
      imageAlt: 'Woman with smooth legs sitting on a white block in a warm studio',
    },
    benefits: ['Smooth skin', 'No more razors', 'Quick sessions', 'Comfort', 'Confidence', 'Less ingrown hair'],
    experience: {
      heading: { lead: 'A smarter path to', accent: 'smooth skin.' },
      body: 'Each plan combines the right technology, the right settings and the right timing for results that last.',
      image: laserExperience,
      imageAlt: 'Smiling woman in a robe showing her smooth legs',
      features: [
        {
          icon: PiShieldCheckLight,
          title: 'Safety first',
          body: 'We review your skin type, medications and contraindications before your first session.',
        },
        {
          icon: PiCalendarBlankLight,
          title: 'A series-based plan',
          body: 'Sessions are spaced to follow your hair growth cycle for better results.',
        },
        {
          icon: PiClockLight,
          title: 'Quick sessions',
          body: 'Small areas take minutes, so laser fits easily into your routine.',
        },
      ],
      question: 'Ready to plan your laser sessions?',
    },
  },
  {
    slug: 'intimate-care',
    hero: {
      title: { lead: 'Intimate', accent: 'Skin Care' },
      subtitle: 'Gentle, discreet protocols that brighten, renew and restore comfort to delicate areas.',
      image: intimateHero,
      imageAlt: 'Woman with glowing skin gently touching her face and shoulder',
      imagePosition: 'object-[center_30%]',
    },
    why: {
      heading: { lead: 'A more intentional approach to', accent: 'intimate care.' },
      body: 'Delicate areas deserve specialized care. Our intimate protocols are performed in a private suite with gentle products for sensitive skin, always with discretion and respect.',
      points: [
        {
          icon: PiLockSimpleLight,
          title: 'Private & judgment-free',
          body: 'One-on-one care in a private suite, with every step explained before we begin.',
        },
        {
          icon: PiLeafLight,
          title: 'Made for sensitive skin',
          body: 'Gentle formulas chosen to cleanse, brighten and soothe without irritation.',
        },
      ],
    },
    menu: {
      heading: { lead: 'Our intimate', accent: 'care menu' },
      groups: [
        {
          items: [
            {
              name: 'Vajacial (Intimate Facial)',
              price: '$120',
              bestSeller: true,
              description: 'Deep cleansing for the bikini area: exfoliation, ingrown-hair care and soothing hydration.',
            },
            {
              name: 'Intimate Peeling',
              price: '$240',
              description: 'A gentle peel that brightens and evens out tone in delicate areas.',
            },
          ],
        },
      ],
      note: 'Not sure which one to choose? We’ll guide you during your consultation.',
      image: intimateMenu,
      imageAlt: 'Close-up of smooth, glowing legs against a warm background',
    },
    benefits: ['Discretion', 'Even tone', 'Ingrown-hair care', 'Comfort', 'Gentle care', 'Confidence'],
    experience: {
      heading: { lead: 'Delicate care,', accent: 'done with respect.' },
      body: 'Every treatment is designed around comfort, hygiene and the health of your most sensitive skin.',
      image: intimateExperience,
      imageAlt: 'Hand resting gently on smooth, hydrated skin',
      features: [
        {
          icon: PiFlowerLotusLight,
          title: 'Discreet by design',
          body: 'A calm, private space where you can feel completely at ease.',
        },
        {
          icon: PiDropLight,
          title: 'Gentle protocols',
          body: 'Soothing, hydrating care that respects sensitive skin before and after treatment.',
        },
        {
          icon: PiHeartLight,
          title: 'Aftercare guidance',
          body: 'Simple instructions to keep your skin calm and comfortable.',
        },
      ],
      question: 'Have questions before you book?',
    },
  },
];

export const findTreatmentPage = (slug: string | undefined) => treatmentPages.find((p) => p.slug === slug);
