'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { HiArrowLeft, HiArrowRight, HiCheck } from 'react-icons/hi';
import { useTranslations } from 'next-intl';
import DrawingPad from '@/components/consent/DrawingPad';
import {
  CONSENT_FORM_VERSION,
  concernChoices,
  conditionChoices,
  consentSections,
  consentText,
  fields,
  interestChoices,
  pressureChoices,
  referralChoices,
  sectionErrors,
  sectionIntros,
  sectionTitles,
  skinTypeChoices,
  type ConsentAnswers,
  type ConsentSection,
} from '@/lib/consent/form';
import { scrollToTarget } from '@/lib/smoothScroll';
import { cn } from '@/lib/utils';
import { StepHeading } from './steps';

export type ConsentDraft = { answers: ConsentAnswers; signedName: string; signature: string | null };

type Props = {
  value: ConsentDraft;
  onChange: (next: ConsentDraft) => void;
  /** Date label of the form the answers were prefilled from (null = first visit) */
  prefilledOn: string | null;
  /** "Back" on the first section: the previous booking step */
  onExit: () => void;
  /** Every section is complete and signed */
  onDone: () => void;
};

/** Local date as YYYY-MM-DD */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fieldClass =
  'w-full rounded-xl border bg-white px-4 py-3 text-base text-ink placeholder:text-muted/60 transition focus:border-bronze focus:outline-none focus:ring-2 focus:ring-accent/30';

const ERROR_KIND: Record<string, string> = {
  email: 'email',
  phone: 'phone',
  dateOfBirth: 'dateOfBirth',
  signature: 'signature',
  concerns: 'choose',
  conditions: 'choose',
  interests: 'choose',
  previousTreatments: 'choose',
  medication: 'choose',
  understood: 'consent',
  proceed: 'consent',
};

const pad = (n: number) => String(n).padStart(2, '0');
const fieldId = (key: string) => `cf-${key}`;

export default function ConsentStep({ value, onChange, prefilledOn, onExit, onDone }: Props) {
  const t = useTranslations('booking.consent');
  const top = useRef<HTMLDivElement>(null);
  const today = useMemo(localToday, []);
  const [index, setIndex] = useState(0);
  const [attempted, setAttempted] = useState<Set<ConsentSection>>(() => new Set());

  const { answers, signedName, signature } = value;
  const sig = { signedName, signature };
  const errorsBy = consentSections.map((s) => sectionErrors(s, answers, sig, today));
  const firstOpen = errorsBy.findIndex((e) => e.length > 0);
  // Sections up to the first incomplete one can be visited; later ones stay locked
  const lastReachable = firstOpen === -1 ? consentSections.length - 1 : firstOpen;

  const section = consentSections[index];
  const errors = errorsBy[index];
  const showErrors = attempted.has(section);
  const invalid = (key: string) => showErrors && errors.includes(key);

  const set = <K extends keyof ConsentAnswers>(group: K, patch: Partial<ConsentAnswers[K]>) =>
    onChange({ ...value, answers: { ...answers, [group]: { ...answers[group], ...patch } } });

  const goTo = (i: number) => {
    // Prints the name from section 01 the first time the signature page opens
    if (consentSections[i] === 'signature' && !signedName.trim()) onChange({ ...value, signedName: answers.client.fullName });
    setIndex(i);
    if (top.current && top.current.getBoundingClientRect().top < 0) scrollToTarget(top.current, { offset: -110 });
  };

  const next = () => {
    if (errors.length > 0) {
      setAttempted((s) => new Set(s).add(section));
      const el = document.getElementById(fieldId(errors[0]));
      if (el) {
        scrollToTarget(el, { offset: -140 });
        el.focus({ preventScroll: true });
      }
      return;
    }
    if (index === consentSections.length - 1) onDone();
    else goTo(index + 1);
  };

  const error = (key: string) =>
    invalid(key) ? (
      <p id={`${fieldId(key)}-error`} className="mt-1.5 text-sm text-accent">
        {t(`errors.${ERROR_KIND[key] ?? 'required'}`)}
      </p>
    ) : null;

  const text = (key: keyof typeof fields, val: string, onValue: (v: string) => void, opts: { type?: string; autoComplete?: string; inputMode?: 'tel' | 'email' | 'text'; multiline?: boolean; max?: number; optional?: boolean; label?: boolean } = {}) => (
    <div>
      {opts.label !== false && (
        <FieldLabel htmlFor={fieldId(key)} optional={opts.optional ? t('optional') : undefined}>
          {fields[key].label}
        </FieldLabel>
      )}
      {opts.multiline ? (
        <textarea
          id={fieldId(key)}
          rows={3}
          maxLength={opts.max ?? 1000}
          value={val}
          placeholder={fields[key].placeholder}
          onChange={(e) => onValue(e.target.value)}
          aria-label={opts.label === false ? fields[key].label : undefined}
          aria-invalid={invalid(key) || undefined}
          aria-describedby={invalid(key) ? `${fieldId(key)}-error` : undefined}
          className={cn(fieldClass, invalid(key) ? 'border-accent ring-2 ring-accent/20' : 'border-taupe')}
        />
      ) : (
        <input
          id={fieldId(key)}
          type={opts.type ?? 'text'}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete}
          maxLength={opts.max ?? 300}
          max={opts.type === 'date' ? today : undefined}
          min={opts.type === 'date' ? '1900-01-01' : undefined}
          value={val}
          placeholder={fields[key].placeholder}
          onChange={(e) => onValue(e.target.value)}
          aria-label={opts.label === false ? fields[key].label : undefined}
          aria-invalid={invalid(key) || undefined}
          aria-describedby={invalid(key) ? `${fieldId(key)}-error` : undefined}
          className={cn(fieldClass, 'h-[50px]', invalid(key) ? 'border-accent ring-2 ring-accent/20' : 'border-taupe')}
        />
      )}
      {error(key)}
    </div>
  );

  const toggle = (list: string[], id: string, exclusive?: string) => {
    if (list.includes(id)) return list.filter((x) => x !== id);
    if (exclusive && id === exclusive) return [id];
    return [...list.filter((x) => x !== exclusive), id];
  };

  return (
    <div ref={top}>
      {/* Progress: "STEP 01 OF 06 · CLIENT INFORMATION" over one segment per section */}
      <nav aria-label={t('progressLabel')}>
        <div className="flex items-baseline justify-between gap-4 text-[11px] uppercase tracking-[0.22em]">
          <span className="shrink-0 text-ink">{t('stepOf', { current: pad(index + 1), total: pad(consentSections.length) })}</span>
          <span className="truncate text-right text-bronze">{sectionTitles[section]}</span>
        </div>
        <ol className="mt-2 grid grid-cols-6 gap-1.5">
          {consentSections.map((s, i) => {
            const reachable = i <= lastReachable;
            const done = errorsBy[i].length === 0;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => goTo(i)}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={reachable ? t('goTo', { number: pad(i + 1), title: sectionTitles[s] }) : t('locked', { number: pad(i + 1), title: sectionTitles[s] })}
                  title={sectionTitles[s]}
                  // Tall hit area, thin bar
                  className="group block w-full py-2.5 focus-visible:outline-none disabled:cursor-not-allowed"
                >
                  <span
                    className={cn(
                      'block h-[3px] rounded-full transition-colors duration-500 group-focus-visible:ring-2 group-focus-visible:ring-accent/50',
                      i <= index ? 'bg-cocoa' : done && reachable ? 'bg-taupe group-hover:bg-bronze' : 'bg-stone',
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {prefilledOn && index === 0 && (
        <div className="mt-5 rounded-2xl border border-stone bg-cream px-4 py-4 sm:px-5">
          <p className="text-sm leading-relaxed text-ink">{t('prefilled', { date: prefilledOn })}</p>
          {firstOpen > 0 && (
            <button type="button" onClick={() => goTo(firstOpen)} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink underline decoration-taupe underline-offset-4">
              {t('jumpToMissing')} <HiArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="mt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{t('section', { number: pad(index + 1) })}</p>
        <div className="mt-2">
          <StepHeading>{sectionTitles[section]}</StepHeading>
        </div>
        <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-muted">{sectionIntros[section]}</p>
      </div>

      <div className="mt-7 flex flex-col gap-6">
        {section === 'client' && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {text('fullName', answers.client.fullName, (v) => set('client', { fullName: v }), { autoComplete: 'name', max: 120 })}
              {text('dateOfBirth', answers.client.dateOfBirth, (v) => set('client', { dateOfBirth: v }), { type: 'date', autoComplete: 'bday' })}
              {text('phone', answers.client.phone, (v) => set('client', { phone: v }), { type: 'tel', inputMode: 'tel', autoComplete: 'tel', max: 40 })}
              {text('email', answers.client.email, (v) => set('client', { email: v }), { type: 'email', inputMode: 'email', autoComplete: 'email', max: 200 })}
              {text('address', answers.client.address, (v) => set('client', { address: v }), { autoComplete: 'street-address', optional: true })}
              {text('emergencyContact', answers.client.emergencyContact, (v) => set('client', { emergencyContact: v }), { max: 200 })}
            </div>
            <ChoiceGroup id={fieldId('referral')} legend={fields.referral.label} optional={t('optional')} columns={3}>
              {referralChoices.map((c) => (
                <CheckTile key={c.id} checked={answers.client.referral.includes(c.id)} onChange={() => set('client', { referral: toggle(answers.client.referral, c.id) })}>
                  {c.label}
                </CheckTile>
              ))}
            </ChoiceGroup>
            {answers.client.referral.includes('other') && text('referralOther', answers.client.referralOther, (v) => set('client', { referralOther: v }), { label: false, max: 200 })}
          </>
        )}

        {section === 'skin' && (
          <>
            <ChoiceGroup id={fieldId('concerns')} legend={fields.concerns.label} invalid={invalid('concerns')} error={error('concerns')}>
              {concernChoices.map((c) => (
                <CheckTile key={c.id} checked={answers.skin.concerns.includes(c.id)} onChange={() => set('skin', { concerns: toggle(answers.skin.concerns, c.id) })}>
                  {c.label}
                </CheckTile>
              ))}
            </ChoiceGroup>
            {answers.skin.concerns.includes('other') && text('concernsOther', answers.skin.concernsOther, (v) => set('skin', { concernsOther: v }), { label: false, max: 200 })}

            <ChoiceGroup id={fieldId('previousTreatments')} legend={fields.previousTreatments.label} invalid={invalid('previousTreatments')} error={error('previousTreatments')} columns={2} radio>
              {(['yes', 'no'] as const).map((v) => (
                <RadioTile key={v} name="previousTreatments" checked={answers.skin.previousTreatments === v} onChange={() => set('skin', { previousTreatments: v })}>
                  {t(v)}
                </RadioTile>
              ))}
            </ChoiceGroup>
            {answers.skin.previousTreatments === 'yes' &&
              text('previousTreatmentsDetails', answers.skin.previousTreatmentsDetails, (v) => set('skin', { previousTreatmentsDetails: v }), { multiline: true })}

            {text('currentProducts', answers.skin.currentProducts, (v) => set('skin', { currentProducts: v }), { multiline: true, optional: true })}

            <ChoiceGroup id={fieldId('skinType')} legend={fields.skinType.label} optional={t('optional')} columns={4} radio>
              {skinTypeChoices.map((c) => (
                <RadioTile
                  key={c.id}
                  name="skinType"
                  checked={answers.skin.skinType === c.id}
                  // Tapping the chosen type again clears it (the question is optional)
                  onChange={() => set('skin', { skinType: c.id as ConsentAnswers['skin']['skinType'] })}
                  onReselect={() => set('skin', { skinType: '' })}
                >
                  {c.label}
                </RadioTile>
              ))}
            </ChoiceGroup>
          </>
        )}

        {section === 'health' && (
          <>
            <ChoiceGroup id={fieldId('conditions')} legend={fields.conditions.label} invalid={invalid('conditions')} error={error('conditions')}>
              {conditionChoices.map((c) => (
                <CheckTile key={c.id} checked={answers.health.conditions.includes(c.id)} onChange={() => set('health', { conditions: toggle(answers.health.conditions, c.id, 'none') })}>
                  {c.label}
                </CheckTile>
              ))}
            </ChoiceGroup>
            {answers.health.conditions.includes('other') && text('conditionsOther', answers.health.conditionsOther, (v) => set('health', { conditionsOther: v }), { label: false })}

            {text('allergies', answers.health.allergies, (v) => set('health', { allergies: v }), { multiline: true, optional: !answers.health.conditions.includes('allergies') })}

            <ChoiceGroup id={fieldId('medication')} legend={fields.medication.label} invalid={invalid('medication')} error={error('medication')} columns={2} radio>
              {(['yes', 'no'] as const).map((v) => (
                <RadioTile key={v} name="medication" checked={answers.health.medication === v} onChange={() => set('health', { medication: v })}>
                  {t(v)}
                </RadioTile>
              ))}
            </ChoiceGroup>
            {answers.health.medication === 'yes' && text('medicationDetails', answers.health.medicationDetails, (v) => set('health', { medicationDetails: v }), { multiline: true })}
          </>
        )}

        {section === 'preferences' && (
          <>
            <ChoiceGroup id={fieldId('interests')} legend={fields.interests.label} invalid={invalid('interests')} error={error('interests')}>
              {interestChoices.map((c) => (
                <CheckTile key={c.id} checked={answers.preferences.interests.includes(c.id)} onChange={() => set('preferences', { interests: toggle(answers.preferences.interests, c.id) })}>
                  {c.label}
                </CheckTile>
              ))}
            </ChoiceGroup>
            {answers.preferences.interests.includes('other') &&
              text('interestsOther', answers.preferences.interestsOther, (v) => set('preferences', { interestsOther: v }), { label: false, max: 200 })}
            <div className="grid gap-5 sm:grid-cols-2">
              {text('goals', answers.preferences.goals, (v) => set('preferences', { goals: v }), { multiline: true, optional: true })}
              {text('avoid', answers.preferences.avoid, (v) => set('preferences', { avoid: v }), { multiline: true, optional: true })}
            </div>
            <ChoiceGroup id={fieldId('pressure')} legend={fields.pressure.label} optional={t('optional')} columns={3} radio>
              {pressureChoices.map((c) => (
                <RadioTile
                  key={c.id}
                  name="pressure"
                  checked={answers.preferences.pressure === c.id}
                  onChange={() => set('preferences', { pressure: c.id as ConsentAnswers['preferences']['pressure'] })}
                  onReselect={() => set('preferences', { pressure: '' })}
                >
                  {c.label}
                </RadioTile>
              ))}
            </ChoiceGroup>
          </>
        )}

        {section === 'consent' && (
          <>
            <div className="flex flex-col gap-3 rounded-2xl border border-stone bg-white/70 px-4 py-5 text-[15px] leading-relaxed text-ink sm:px-6">
              {consentText[CONSENT_FORM_VERSION].paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              {consentText[CONSENT_FORM_VERSION].statements.map((s) => (
                <div key={s.id}>
                  <CheckTile id={fieldId(s.id)} checked={answers.consent[s.id]} invalid={invalid(s.id)} onChange={() => set('consent', { [s.id]: !answers.consent[s.id] })}>
                    {s.label}
                  </CheckTile>
                  {error(s.id)}
                </div>
              ))}
            </div>
          </>
        )}

        {section === 'signature' && (
          <>
            {text('signedName', signedName, (v) => onChange({ ...value, signedName: v }), { autoComplete: 'name', max: 120 })}
            <div>
              <FieldLabel htmlFor={fieldId('signature')}>{fields.signature.label}</FieldLabel>
              <div id={fieldId('signature')} tabIndex={-1} className="focus:outline-none">
                <DrawingPad
                  value={signature}
                  onChange={(v) => onChange({ ...value, signature: v })}
                  label={fields.signature.label}
                  clearLabel={t('clear')}
                  placeholder={fields.signature.placeholder}
                  aspectRatio={5 / 2}
                  invalid={invalid('signature')}
                />
              </div>
              {error('signature')}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">{fields.date.label}</p>
              <p className="text-[15px] text-muted">{new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(`${today}T12:00:00`))}</p>
            </div>
          </>
        )}
      </div>

      {showErrors && errors.length > 0 && (
        <p role="alert" className="mt-6 rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
          {t('fixErrors')}
        </p>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => (index === 0 ? onExit() : goTo(index - 1))}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm text-muted transition hover:bg-sand hover:text-ink"
        >
          <HiArrowLeft className="h-4 w-4" /> {t('back')}
        </button>
        <button type="button" onClick={next} className="btn-dark w-full justify-center sm:w-auto">
          {index === consentSections.length - 1 ? t('finish') : t('next')}
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Building blocks
// -----------------------------------------------------------------------------

function FieldLabel({ htmlFor, optional, children }: { htmlFor: string; optional?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink">
      {children} {optional && <span className="text-xs font-normal text-muted">({optional})</span>}
    </label>
  );
}

function ChoiceGroup({
  id,
  legend,
  optional,
  invalid,
  error,
  columns = 2,
  radio,
  children,
}: {
  id: string;
  legend: string;
  optional?: string;
  invalid?: boolean;
  error?: ReactNode;
  columns?: 2 | 3 | 4;
  radio?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset id={id} tabIndex={-1} role={radio ? 'radiogroup' : undefined} aria-invalid={invalid || undefined} className="focus:outline-none">
      <legend className="mb-2 text-sm font-medium text-ink">
        {legend} {optional && <span className="text-xs font-normal text-muted">({optional})</span>}
      </legend>
      <div
        className={cn(
          'grid gap-2',
          // One column on phones for long labels; short choices sit side by side
          columns === 2 && (radio ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'),
          columns === 3 && 'grid-cols-2 sm:grid-cols-3',
          columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {children}
      </div>
      {error}
    </fieldset>
  );
}

const tileClass = (checked: boolean, invalid?: boolean) =>
  cn(
    'flex min-h-[50px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] leading-snug transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40',
    checked ? 'border-cocoa bg-cream text-ink' : invalid ? 'border-accent bg-white text-ink' : 'border-taupe/70 bg-white text-ink hover:border-bronze',
  );

function CheckTile({ id, checked, invalid, onChange, children }: { id?: string; checked: boolean; invalid?: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className={tileClass(checked, invalid)}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition', checked ? 'border-cocoa bg-cocoa text-cream' : 'border-taupe bg-white')}
      >
        {checked && <HiCheck className="h-3.5 w-3.5" />}
      </span>
      <span>{children}</span>
    </label>
  );
}

function RadioTile({ name, checked, onChange, onReselect, children }: { name: string; checked: boolean; onChange: () => void; onReselect?: () => void; children: ReactNode }) {
  return (
    <label className={cn(tileClass(checked), 'justify-center text-center')}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        onClick={() => {
          if (checked) onReselect?.();
        }}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn('h-4 w-4 shrink-0 rounded-full border transition', checked ? 'border-[5px] border-cocoa bg-white' : 'border-taupe bg-white')}
      />
      <span>{children}</span>
    </label>
  );
}
