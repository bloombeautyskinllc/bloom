import { describe, expect, it } from 'vitest';
import { answersSchema, emptyAnswers, estheticianSchema, interestFor, isComplete, parseSubmission, prefillAnswers, sectionErrors, type ConsentAnswers } from './form';

const TODAY = '2026-10-06';
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';

function completeAnswers(): ConsentAnswers {
  const a = emptyAnswers();
  a.client = { ...a.client, fullName: 'Ana Pérez', phone: '+1 347 555 0100', email: 'ana@example.com', dateOfBirth: '1990-04-12', emergencyContact: 'Luis, 347 555 0101' };
  a.skin = { ...a.skin, concerns: ['acne'], previousTreatments: 'no' };
  a.health = { ...a.health, conditions: ['none'], medication: 'no' };
  a.preferences = { ...a.preferences, interests: ['microneedling'] };
  a.consent = { understood: true, proceed: true, photos: false };
  return a;
}

describe('sectionErrors', () => {
  it('requires the core client details', () => {
    expect(sectionErrors('client', emptyAnswers(), { signedName: '', signature: null }, TODAY)).toEqual(['fullName', 'phone', 'email', 'dateOfBirth', 'emergencyContact']);
  });

  it('rejects a date of birth in the future', () => {
    const a = completeAnswers();
    a.client.dateOfBirth = '2030-01-01';
    expect(sectionErrors('client', a, { signedName: '', signature: null }, TODAY)).toEqual(['dateOfBirth']);
  });

  it('asks for details only when the answer needs them', () => {
    const a = completeAnswers();
    a.skin.previousTreatments = 'yes';
    a.health.medication = 'yes';
    a.health.conditions = ['allergies', 'other'];
    const sig = { signedName: '', signature: null };
    expect(sectionErrors('skin', a, sig, TODAY)).toEqual(['previousTreatmentsDetails']);
    expect(sectionErrors('health', a, sig, TODAY)).toEqual(['conditionsOther', 'allergies', 'medicationDetails']);
  });

  it('needs both required consent statements, not the photo one', () => {
    const a = completeAnswers();
    a.consent = { understood: true, proceed: false, photos: false };
    expect(sectionErrors('consent', a, { signedName: '', signature: null }, TODAY)).toEqual(['proceed']);
  });

  it('needs a printed name and a drawn signature', () => {
    expect(sectionErrors('signature', completeAnswers(), { signedName: 'A', signature: null }, TODAY)).toEqual(['signedName', 'signature']);
    expect(isComplete(completeAnswers(), { signedName: 'Ana Pérez', signature: SIGNATURE }, TODAY)).toBe(true);
  });
});

describe('prefillAnswers', () => {
  it('starts from the profile on a first visit', () => {
    const a = prefillAnswers(null, { fullName: 'Ana Pérez', email: 'ana@example.com', phone: '+1 347 555 0100' }, 'Dermaplaning Treatment');
    expect(a.client.fullName).toBe('Ana Pérez');
    expect(a.client.email).toBe('ana@example.com');
    expect(a.preferences.interests).toEqual(['dermaplaning']);
  });

  it('carries over the last form but never the consent', () => {
    const previous = completeAnswers();
    previous.consent.photos = true;
    previous.client.address = '305 E 204th St';
    const a = prefillAnswers(previous, { fullName: 'Other Name', email: null, phone: null }, 'Back Facial');
    expect(a.client.fullName).toBe('Ana Pérez');
    expect(a.client.address).toBe('305 E 204th St');
    expect(a.health.conditions).toEqual(['none']);
    expect(a.preferences.interests).toEqual(['back-facial']);
    expect(a.consent).toEqual({ understood: false, proceed: false, photos: false });
    // Only the consent and the signature are left
    const missing = (['client', 'skin', 'health', 'preferences', 'consent'] as const).filter((s) => sectionErrors(s, a, { signedName: '', signature: null }, TODAY).length);
    expect(missing).toEqual(['consent']);
  });

  it('survives old or tampered answers', () => {
    const a = prefillAnswers({ client: { fullName: 42, referral: ['instagram', 'nope'] }, health: 'x' }, { fullName: 'Ana', email: null, phone: null }, null);
    expect(a.client.fullName).toBe('Ana');
    expect(a.client.referral).toEqual(['instagram']);
    expect(a.health.conditions).toEqual([]);
  });
});

describe('interestFor', () => {
  it('maps catalog names to the form choices', () => {
    expect(interestFor('Pumpkin Peel Facial (Vitamin A)').interests).toEqual(['vitamin-c-pumpkin']);
    expect(interestFor('Face Peeling (Mesopeel)').interests).toEqual(['mesopeel']);
    expect(interestFor('Shadow Brows')).toEqual({ interests: ['other'], interestsOther: 'Shadow Brows' });
  });
});

describe('parseSubmission', () => {
  it('accepts a complete form and drops unknown keys', () => {
    const answers = { ...completeAnswers(), extra: 'x' };
    const parsed = parseSubmission({ answers, signedName: 'Ana Pérez', signature: SIGNATURE }, TODAY);
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty('extra');
  });

  it('rejects a form without consent', () => {
    const answers = completeAnswers();
    answers.consent.understood = false;
    expect(parseSubmission({ answers, signedName: 'Ana Pérez', signature: SIGNATURE }, TODAY)).toBeNull();
  });
});

describe('schemas', () => {
  it('fills defaults for empty input', () => {
    expect(answersSchema.parse({}).client.referral).toEqual([]);
    expect(estheticianSchema.parse({}).faceMaps).toEqual({ front: null, profile: null });
  });
});
