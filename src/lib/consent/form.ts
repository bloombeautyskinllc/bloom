import { z } from 'zod';

// Client intake and consent form (the studio's paper form, "Group 15"). Shared by the booking flow,
// the server action, the back office and the PDF. The stored answers keep option ids; labels and
// the consent wording come from here by form version, so a signed form always renders as it was signed.
// Changing the consent wording means bumping CONSENT_FORM_VERSION and keeping the old text.

export const CONSENT_FORM_VERSION = 1;

type Choice = { id: string; label: string };

export const referralChoices: Choice[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'google', label: 'Google' },
  { id: 'referral', label: 'Referral' },
  { id: 'walk-in', label: 'Walk-in' },
  { id: 'other', label: 'Other' },
];

export const concernChoices: Choice[] = [
  { id: 'acne', label: 'Acne' },
  { id: 'aging', label: 'Aging / Fine lines' },
  { id: 'pores', label: 'Uneven texture / Large pores' },
  { id: 'sensitive', label: 'Sensitive skin' },
  { id: 'dryness', label: 'Dryness' },
  { id: 'hyperpigmentation', label: 'Hyperpigmentation / Dark spots' },
  { id: 'redness', label: 'Redness / Rosacea' },
  { id: 'oiliness', label: 'Oiliness' },
  { id: 'dark-circles', label: 'Dark circles' },
  { id: 'other', label: 'Other' },
];

export const skinTypeChoices: Choice[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'dry', label: 'Dry' },
  { id: 'oily', label: 'Oily' },
  { id: 'combination', label: 'Combination' },
];

/** "None of these" is not on the paper form: online, it tells an unanswered list from a clear history. */
export const conditionChoices: Choice[] = [
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'high-blood-pressure', label: 'High blood pressure' },
  { id: 'heart-condition', label: 'Heart condition' },
  { id: 'autoimmune', label: 'Autoimmune disease' },
  { id: 'epilepsy', label: 'Epilepsy' },
  { id: 'cancer', label: 'Cancer' },
  { id: 'pregnant', label: 'Pregnant or breastfeeding' },
  { id: 'skin-conditions', label: 'Skin conditions (eczema, psoriasis…)' },
  { id: 'isotretinoin', label: 'Isotretinoin / Accutane (last 6 months)' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'recent-surgery', label: 'Recent surgery' },
  { id: 'keloid', label: 'Keloid scarring' },
  { id: 'other', label: 'Other' },
  { id: 'none', label: 'None of these' },
];

export const interestChoices: (Choice & { match?: RegExp })[] = [
  { id: 'signature-facial', label: 'My Signature Facial', match: /signature/i },
  { id: 'hydrodermabrasion', label: 'Hydrodermabrasion', match: /hydrodermabrasion/i },
  { id: 'microneedling', label: 'Microneedling', match: /microneedling/i },
  { id: 'dermaplaning', label: 'Dermaplaning', match: /dermaplaning/i },
  { id: 'oxygen-facial', label: 'Oxygen Infusion Facial', match: /oxygen/i },
  { id: 'mesopeel', label: 'Face Peeling (Mesopeel)', match: /mesopeel|face peeling/i },
  { id: 'vitamin-c-pumpkin', label: 'Vitamin C / Pumpkin Peel', match: /vitamin c|pumpkin/i },
  { id: 'back-facial', label: 'Back Facial', match: /back facial/i },
  { id: 'not-sure', label: 'Not sure, recommend for me' },
  { id: 'other', label: 'Other' },
];

export const pressureChoices: Choice[] = [
  { id: 'gentle', label: 'Gentle' },
  { id: 'medium', label: 'Medium' },
  { id: 'firm', label: 'Firm' },
];

/** Consent wording by form version (section 05). */
export const consentText: Record<number, { paragraphs: string[]; statements: { id: 'understood' | 'proceed' | 'photos'; label: string; required: boolean }[] }> = {
  1: {
    paragraphs: [
      'I confirm that the information I have provided in this form is accurate and complete to the best of my knowledge. I understand that withholding or misstating information about my health, medications, allergies or skin history may affect the safety and results of my treatment, and that BLOOM Beauty Skin is not responsible for outcomes caused by information I did not disclose.',
      'I understand that aesthetic treatments, including facials, peels, microneedling, dermaplaning, laser hair removal, micropigmentation and depigmentation protocols, may cause temporary effects such as redness, sensitivity, swelling, dryness, peeling, itching, bruising or irritation and, less commonly, blistering, infection, scarring or changes in skin pigmentation. My specialist has explained the treatment I am receiving and I have had the opportunity to ask questions.',
      'I will tell my specialist before every appointment about any change in my health, medications, pregnancy status or skin condition, including recent sun exposure, tanning, waxing, chemical exfoliation or the use of retinoids or isotretinoin. I understand that my specialist may adjust, postpone or decline a treatment when it is not safe for me.',
      'I understand that results vary from person to person, that some treatments require several sessions, and that no specific result has been guaranteed to me. I agree to follow the pre- and post-treatment care instructions provided by BLOOM Beauty Skin, and I understand that not following them may affect my results and increase the risk of side effects.',
      'I voluntarily consent to receive the selected treatment today, and I may ask to pause or stop it at any time. If I am signing on behalf of a minor, I confirm that I am their parent or legal guardian and that I give this consent on their behalf.',
      'I authorize BLOOM Beauty Skin to keep this form and the records of my treatments as part of my confidential clinical record. This information is used only to provide and document my care, and it is never shared without my consent except where required by law.',
    ],
    statements: [
      { id: 'understood', label: 'I have read and understand the above information.', required: true },
      { id: 'proceed', label: 'I give my consent to proceed with the treatment.', required: true },
      { id: 'photos', label: 'I consent to before and after photos for my clinical record (optional).', required: false },
    ],
  },
};

// -----------------------------------------------------------------------------
// Answers
// -----------------------------------------------------------------------------

const text = (max = 500) => z.string().trim().max(max).catch('');
const ids = (choices: Choice[]) =>
  z
    .array(z.string())
    .catch([])
    .transform((list) => [...new Set(list)].filter((id) => choices.some((c) => c.id === id)));
const oneOf = <T extends string>(values: readonly T[]) => z.enum(values).or(z.literal('')).catch('');

/** Lenient shape: unknown keys are dropped and bad values reset, so old or partial answers still load. */
export const answersSchema = z.object({
  client: z
    .object({
      fullName: text(120),
      phone: text(40),
      email: text(200),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).catch(''),
      address: text(300),
      emergencyContact: text(200),
      referral: ids(referralChoices),
      referralOther: text(200),
    })
    .catch({ fullName: '', phone: '', email: '', dateOfBirth: '', address: '', emergencyContact: '', referral: [], referralOther: '' }),
  skin: z
    .object({
      concerns: ids(concernChoices),
      concernsOther: text(200),
      previousTreatments: oneOf(['yes', 'no'] as const),
      previousTreatmentsDetails: text(1000),
      currentProducts: text(1000),
      skinType: oneOf(['normal', 'dry', 'oily', 'combination'] as const),
    })
    .catch({ concerns: [], concernsOther: '', previousTreatments: '', previousTreatmentsDetails: '', currentProducts: '', skinType: '' }),
  health: z
    .object({
      conditions: ids(conditionChoices),
      conditionsOther: text(300),
      medication: oneOf(['yes', 'no'] as const),
      medicationDetails: text(1000),
      allergies: text(1000),
    })
    .catch({ conditions: [], conditionsOther: '', medication: '', medicationDetails: '', allergies: '' }),
  preferences: z
    .object({
      interests: ids(interestChoices),
      interestsOther: text(200),
      goals: text(1000),
      avoid: text(1000),
      pressure: oneOf(['gentle', 'medium', 'firm'] as const),
    })
    .catch({ interests: [], interestsOther: '', goals: '', avoid: '', pressure: '' }),
  consent: z
    .object({ understood: z.boolean().catch(false), proceed: z.boolean().catch(false), photos: z.boolean().catch(false) })
    .catch({ understood: false, proceed: false, photos: false }),
});

export type ConsentAnswers = z.infer<typeof answersSchema>;

export const emptyAnswers = (): ConsentAnswers => answersSchema.parse({});

// -----------------------------------------------------------------------------
// Sections and required fields
// -----------------------------------------------------------------------------

export const consentSections = ['client', 'skin', 'health', 'preferences', 'consent', 'signature'] as const;
export type ConsentSection = (typeof consentSections)[number];

export const sectionTitles: Record<ConsentSection, string> = {
  client: 'Client information',
  skin: 'Skin history',
  health: 'Health history',
  preferences: 'Treatment preferences',
  consent: 'Consent & acknowledgment',
  signature: 'Signature',
};

export const sectionIntros: Record<ConsentSection, string> = {
  client: 'Your details stay private and are used only for your clinical record and appointment reminders.',
  skin: 'Every protocol at BLOOM begins with a diagnosis, not a menu. Tell us what your skin is going through today.',
  health: 'Some conditions and medications change how your skin responds. This keeps every session safe for you.',
  preferences: 'Not sure what to choose? Leave it to us: your cosmetologist will recommend the right protocol after your skin analysis.',
  consent: 'Please read carefully before signing.',
  signature: 'Sign with your finger, a stylus or your mouse.',
};

/** Field labels and placeholders, as printed on the form */
export const fields = {
  fullName: { label: 'Full name', placeholder: 'Your full name' },
  phone: { label: 'Phone / WhatsApp', placeholder: '+1 (000) 000-0000' },
  address: { label: 'Address', placeholder: 'Street, city, ZIP' },
  dateOfBirth: { label: 'Date of birth', placeholder: 'MM / DD / YYYY' },
  email: { label: 'Email', placeholder: 'name@email.com' },
  emergencyContact: { label: 'Emergency contact', placeholder: 'Name and phone' },
  referral: { label: 'How did you hear about us?', placeholder: '' },
  referralOther: { label: 'Where did you hear about us?', placeholder: 'Tell us where' },
  concerns: { label: 'What are your main skin concerns?', placeholder: '' },
  concernsOther: { label: 'Other skin concern', placeholder: 'Describe your concern' },
  previousTreatments: { label: 'Have you had professional facial treatments before?', placeholder: '' },
  previousTreatmentsDetails: { label: 'If yes, what type and when?', placeholder: 'Peels, microneedling, laser, fillers…' },
  currentProducts: { label: 'Current skincare products', placeholder: 'Cleanser, serums, retinoids, acids, SPF…' },
  skinType: { label: 'Skin type (if known)', placeholder: '' },
  conditions: { label: 'Do you have any of the following? (check all that apply)', placeholder: '' },
  conditionsOther: { label: 'Other condition', placeholder: 'Please describe' },
  medication: { label: 'Are you currently taking any medication?', placeholder: '' },
  medicationDetails: { label: 'If yes, please list', placeholder: 'Medication name and dosage' },
  allergies: { label: 'Allergies (medications, cosmetics, latex…)', placeholder: 'List any known allergies' },
  interests: { label: 'What are you interested in today?', placeholder: '' },
  interestsOther: { label: 'Other treatment', placeholder: 'Treatment name' },
  goals: { label: 'Do you have any specific goals?', placeholder: 'e.g. brighter skin, fewer breakouts, smoother texture…' },
  avoid: { label: 'Any areas you would like us to avoid?', placeholder: 'Areas, products or techniques' },
  pressure: { label: 'Preferred level of pressure / sensitivity', placeholder: '' },
  signedName: { label: 'Client name (print)', placeholder: 'Full name' },
  signature: { label: 'Client signature', placeholder: 'Sign here' },
  date: { label: 'Date', placeholder: 'MM / DD / YYYY' },
} as const;

export type SignatureInput = { signedName: string; signature: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blank = (s: string) => s.trim() === '';

/** Today in the browser as YYYY-MM-DD (dates of birth are compared as strings). */
const isPastDate = (iso: string, today: string) => iso >= '1900-01-01' && iso < today;

/** Field keys still missing or invalid in a section ("" = complete). Used for gating in the UI and on the server. */
export function sectionErrors(section: ConsentSection, a: ConsentAnswers, sig: SignatureInput, today: string): string[] {
  const errors: string[] = [];
  const need = (ok: boolean, key: string) => {
    if (!ok) errors.push(key);
  };
  switch (section) {
    case 'client':
      need(a.client.fullName.trim().length >= 2, 'fullName');
      need(a.client.phone.replace(/\D/g, '').length >= 7, 'phone');
      need(EMAIL.test(a.client.email.trim()), 'email');
      need(isPastDate(a.client.dateOfBirth, today), 'dateOfBirth');
      need(!blank(a.client.emergencyContact), 'emergencyContact');
      if (a.client.referral.includes('other')) need(!blank(a.client.referralOther), 'referralOther');
      break;
    case 'skin':
      need(a.skin.concerns.length > 0, 'concerns');
      if (a.skin.concerns.includes('other')) need(!blank(a.skin.concernsOther), 'concernsOther');
      need(a.skin.previousTreatments !== '', 'previousTreatments');
      if (a.skin.previousTreatments === 'yes') need(!blank(a.skin.previousTreatmentsDetails), 'previousTreatmentsDetails');
      break;
    case 'health':
      need(a.health.conditions.length > 0, 'conditions');
      if (a.health.conditions.includes('other')) need(!blank(a.health.conditionsOther), 'conditionsOther');
      if (a.health.conditions.includes('allergies')) need(!blank(a.health.allergies), 'allergies');
      need(a.health.medication !== '', 'medication');
      if (a.health.medication === 'yes') need(!blank(a.health.medicationDetails), 'medicationDetails');
      break;
    case 'preferences':
      need(a.preferences.interests.length > 0, 'interests');
      if (a.preferences.interests.includes('other')) need(!blank(a.preferences.interestsOther), 'interestsOther');
      break;
    case 'consent':
      for (const s of consentText[CONSENT_FORM_VERSION].statements) if (s.required) need(a.consent[s.id], s.id);
      break;
    case 'signature':
      need(sig.signedName.trim().length >= 2, 'signedName');
      need(Boolean(sig.signature), 'signature');
      break;
  }
  return errors;
}

export function isComplete(a: ConsentAnswers, sig: SignatureInput, today: string) {
  return consentSections.every((s) => sectionErrors(s, a, sig, today).length === 0);
}

// -----------------------------------------------------------------------------
// Prefill
// -----------------------------------------------------------------------------

/** The paper form's treatment for the booked treatment ("other" with its name when it is not listed). */
export function interestFor(treatmentName: string): Pick<ConsentAnswers['preferences'], 'interests' | 'interestsOther'> {
  const match = interestChoices.find((c) => c.match?.test(treatmentName));
  return match ? { interests: [match.id], interestsOther: '' } : { interests: ['other'], interestsOther: treatmentName };
}

/**
 * Starting answers for a new booking: the client's latest form when there is one (sections 01–04),
 * otherwise their profile. Today's treatment always comes from the booking, and the consent
 * statements and signature are never carried over.
 */
export function prefillAnswers(
  previous: unknown,
  profile: { fullName: string | null; email: string | null; phone: string | null },
  treatmentName: string | null,
): ConsentAnswers {
  const base = previous ? answersSchema.parse(previous) : emptyAnswers();
  return {
    ...base,
    client: {
      ...base.client,
      fullName: base.client.fullName || profile.fullName || '',
      email: base.client.email || profile.email || '',
      phone: base.client.phone || profile.phone || '',
    },
    preferences: { ...base.preferences, ...(treatmentName ? interestFor(treatmentName) : {}) },
    consent: { understood: false, proceed: false, photos: false },
  };
}

/** Strict server-side check of a submitted form. */
export function parseSubmission(input: { answers: unknown; signedName: string; signature: string }, today: string) {
  const answers = answersSchema.parse(input.answers);
  const sig = { signedName: input.signedName, signature: input.signature };
  return isComplete(answers, sig, today) ? answers : null;
}

/** Label for a stored option id, for the PDF and the back office. */
export const labelOf = (choices: Choice[], id: string) => choices.find((c) => c.id === id)?.label ?? id;

// -----------------------------------------------------------------------------
// Esthetician part (sections 07–08), filled in the back office
// -----------------------------------------------------------------------------

export const analysisFields = [
  { id: 'skinType', label: 'Skin type' },
  { id: 'sensitivity', label: 'Sensitivity' },
  { id: 'acne', label: 'Acne / congestion' },
  { id: 'pigmentation', label: 'Pigmentation' },
  { id: 'texture', label: 'Texture / pores' },
  { id: 'fineLines', label: 'Fine lines' },
  { id: 'hydration', label: 'Hydration level' },
  { id: 'other', label: 'Other' },
] as const;

export const recordFields = [
  { id: 'date', label: 'Date', type: 'date' },
  { id: 'treatment', label: 'Treatment performed', type: 'text' },
  { id: 'esthetician', label: 'Esthetician', type: 'text' },
  { id: 'nextAppointment', label: 'Next appointment', type: 'date' },
  { id: 'products', label: 'Products used', type: 'textarea' },
  { id: 'response', label: 'Skin response / notes', type: 'textarea' },
  { id: 'homeCare', label: 'Home care recommendations', type: 'textarea' },
] as const;

const png = z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/).max(300_000);

export const estheticianSchema = z.object({
  estheticianName: text(120),
  analysis: z.object(Object.fromEntries(analysisFields.map((f) => [f.id, text(300)])) as Record<(typeof analysisFields)[number]['id'], ReturnType<typeof text>>).catch(
    Object.fromEntries(analysisFields.map((f) => [f.id, ''])) as Record<(typeof analysisFields)[number]['id'], string>,
  ),
  faceMaps: z.object({ front: png.nullable().catch(null), profile: png.nullable().catch(null) }).catch({ front: null, profile: null }),
  record: z.object(Object.fromEntries(recordFields.map((f) => [f.id, text(1000)])) as Record<(typeof recordFields)[number]['id'], ReturnType<typeof text>>).catch(
    Object.fromEntries(recordFields.map((f) => [f.id, ''])) as Record<(typeof recordFields)[number]['id'], string>,
  ),
});

export type EstheticianRecord = z.infer<typeof estheticianSchema>;

export const emptyEstheticianRecord = (): EstheticianRecord => estheticianSchema.parse({});
