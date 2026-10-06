import 'server-only';
import path from 'node:path';
import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { site } from '@/data/site';
import { LOGO_MARK_COCOA_PNG_BASE64, LOGO_MARK_SIZE } from '@/emails/assets/logo';
import { FACE_STROKE, FACE_VIEWBOX, facePaths, type FaceView } from './face-maps';
import {
  analysisFields,
  concernChoices,
  conditionChoices,
  consentText,
  fields,
  interestChoices,
  labelOf,
  pressureChoices,
  recordFields,
  referralChoices,
  sectionIntros,
  sectionTitles,
  skinTypeChoices,
  type ConsentAnswers,
  type ConsentSection,
  type EstheticianRecord,
} from './form';

// The signed form as a PDF, laid out like the studio's paper form. Rendered on demand from the
// stored answers (GET /api/bookings/[id]/consent), so it always includes the esthetician part.
// Fonts ship in src/assets/fonts (traced into the route by next.config.ts).

const fontDir = path.join(process.cwd(), 'src', 'assets', 'fonts');
Font.register({
  family: 'Jakarta',
  fonts: [
    { src: path.join(fontDir, 'plus-jakarta-sans-latin-400-normal.woff'), fontWeight: 400 },
    { src: path.join(fontDir, 'plus-jakarta-sans-latin-500-normal.woff'), fontWeight: 500 },
    { src: path.join(fontDir, 'plus-jakarta-sans-latin-700-normal.woff'), fontWeight: 700 },
  ],
});
Font.register({
  family: 'Cormorant',
  fonts: [
    { src: path.join(fontDir, 'cormorant-garamond-latin-400-normal.woff') },
    { src: path.join(fontDir, 'cormorant-garamond-latin-400-italic.woff'), fontStyle: 'italic' },
  ],
});
// Words are never split with a hyphen
Font.registerHyphenationCallback((word) => [word]);

const c = { cream: '#FAF8F5', sand: '#F4EFEA', stone: '#E4DCD2', taupe: '#CDC2B4', bronze: '#725F4C', cocoa: '#31251B', ink: '#231B15', muted: '#5E4F41' };

const s = StyleSheet.create({
  page: { backgroundColor: c.sand, paddingTop: 30, paddingBottom: 44, paddingHorizontal: 32, fontFamily: 'Jakarta', fontSize: 9, color: c.ink, lineHeight: 1.4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docTitle: { fontFamily: 'Cormorant', fontSize: 24, lineHeight: 1.2, color: c.ink },
  meta: { fontSize: 8.5, color: c.muted, textAlign: 'right' },
  card: { backgroundColor: c.cream, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 20, marginBottom: 10 },
  cardHead: { marginBottom: 8 },
  eyebrow: { fontSize: 6.5, letterSpacing: 2.2, textTransform: 'uppercase', color: c.bronze, marginBottom: 2 },
  title: { fontFamily: 'Cormorant', fontSize: 19, lineHeight: 1.2, color: c.ink },
  intro: { fontSize: 8, color: c.muted, marginTop: 2 },
  row: { flexDirection: 'row', gap: 16 },
  cell: { flex: 1 },
  col: { flex: 1 },
  field: { marginBottom: 7 },
  label: { fontSize: 6.5, letterSpacing: 1.4, textTransform: 'uppercase', color: c.bronze, marginBottom: 2 },
  value: { borderBottomWidth: 0.6, borderBottomColor: c.taupe, paddingBottom: 2, minHeight: 14 },
  empty: { color: c.taupe },
  choices: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 1 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3, paddingRight: 6 },
  box: { width: 9, height: 9, borderWidth: 0.7, borderColor: c.taupe, borderRadius: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: c.cocoa, borderColor: c.cocoa },
  paragraph: { fontSize: 8.5, marginBottom: 5 },
  signature: { height: 56, borderBottomWidth: 0.6, borderBottomColor: c.taupe, justifyContent: 'flex-end' },
  signatureImage: { height: 52, objectFit: 'contain', objectPosition: 'left bottom' },
  faces: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  face: { width: 120, height: 150, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.6, borderColor: c.stone, padding: 6 },
  // LETTER is 792pt tall; 'bottom' misplaces fixed elements next to unbreakable blocks
  footer: { position: 'absolute', top: 760, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: c.muted },
});

export type ConsentPdfData = {
  bookingCode: string;
  treatmentName: string;
  appointmentLabel: string;
  formVersion: number;
  answers: ConsentAnswers;
  signedName: string;
  clientSignature: string;
  signedAtLabel: string;
  esthetician: EstheticianRecord | null;
  estheticianSignature: string | null;
  estheticianSignedAtLabel: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

function Section({ number, section, staff, title, intro, children }: { number: number; section?: ConsentSection; staff?: boolean; title?: string; intro?: string; children: ReactNode }) {
  return (
    <View style={s.card} wrap={false}>
      <View style={s.cardHead}>
        <Text style={s.eyebrow}>
          Section {pad(number)}
          {staff ? '   ·   Esthetician' : ''}
        </Text>
        <Text style={s.title}>{title ?? (section ? sectionTitles[section] : '')}</Text>
        {(intro ?? (section ? sectionIntros[section] : null)) && <Text style={s.intro}>{intro ?? sectionIntros[section!]}</Text>}
      </View>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={s.field} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <View style={s.value}>{value?.trim() ? <Text>{value}</Text> : <Text style={s.empty}>—</Text>}</View>
    </View>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <View style={on ? [s.box, s.boxOn] : s.box}>
      {on && (
        <Svg width={7} height={7} viewBox="0 0 10 10">
          <Path d="M2 5.2 L4.2 7.4 L8 3" stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

function Choices({ label, choices, selected, columns = 3, other }: { label: string; choices: { id: string; label: string }[]; selected: string[]; columns?: number; other?: string }) {
  return (
    <View style={s.field} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <View style={s.choices}>
        {choices.map((choice) => (
          <View key={choice.id} style={[s.choice, { width: `${100 / columns}%` }]}>
            <Check on={selected.includes(choice.id)} />
            <Text>
              {choice.label}
              {choice.id === 'other' && selected.includes('other') && other ? `: ${other}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SignatureBox({ label, image }: { label: string; image: string | null }) {
  return (
    <View style={[s.field, s.col]} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <View style={s.signature}>{image ? <Image src={image} style={s.signatureImage} /> : <Text style={s.empty}> </Text>}</View>
    </View>
  );
}

function Face({ view, drawing }: { view: FaceView; drawing: string | null }) {
  const size = { width: 108, height: (108 * FACE_VIEWBOX.height) / FACE_VIEWBOX.width };
  return (
    <View style={s.face}>
      <View style={{ position: 'relative', ...size }}>
        <Svg {...size} viewBox={`0 0 ${FACE_VIEWBOX.width} ${FACE_VIEWBOX.height}`}>
          {facePaths[view].map((d) => (
            <Path key={d} d={d} stroke={FACE_STROKE} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
        {drawing && (
          <View style={{ position: 'absolute', top: 0, left: 0, ...size }}>
            <Image src={drawing} style={{ width: '100%', height: '100%' }} />
          </View>
        )}
      </View>
    </View>
  );
}

const yesNo = (v: string) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '');
const formatDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return `${m} / ${d} / ${y}`;
};

function ConsentDocument(d: ConsentPdfData) {
  const a = d.answers;
  const consent = consentText[d.formVersion] ?? consentText[1];
  const e = d.esthetician;
  return (
    <Document title={`Intake & consent form · ${d.bookingCode}`} author="BLOOM Beauty Skin" subject={`${d.treatmentName} · ${d.appointmentLabel}`}>
      <Page size="LETTER" style={s.page}>
        <View style={s.footer} fixed>
          <Text>
            BLOOM Beauty Skin · {site.phone} · {site.email} · Confidential clinical record · {d.bookingCode}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

        <View style={s.header}>
          <View style={s.brand}>
            <Image src={`data:image/png;base64,${LOGO_MARK_COCOA_PNG_BASE64}`} style={{ width: LOGO_MARK_SIZE.width / 2.4, height: LOGO_MARK_SIZE.height / 2.4 }} />
            <View>
              <Text style={{ fontSize: 7, letterSpacing: 2.4, textTransform: 'uppercase', color: c.bronze }}>BLOOM Beauty Skin</Text>
              <Text style={s.docTitle}>Client intake & consent</Text>
            </View>
          </View>
          <View>
            <Text style={s.meta}>Booking {d.bookingCode}</Text>
            <Text style={s.meta}>{d.treatmentName}</Text>
            <Text style={s.meta}>{d.appointmentLabel}</Text>
          </View>
        </View>

        <Section number={1} section="client">
          <View style={s.row}>
            <View style={s.cell}>
              <Field label={fields.fullName.label} value={a.client.fullName} />
            </View>
            <View style={s.cell}>
              <Field label={fields.dateOfBirth.label} value={formatDate(a.client.dateOfBirth)} />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cell}>
              <Field label={fields.phone.label} value={a.client.phone} />
            </View>
            <View style={s.cell}>
              <Field label={fields.email.label} value={a.client.email} />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.cell}>
              <Field label={fields.address.label} value={a.client.address} />
            </View>
            <View style={s.cell}>
              <Field label={fields.emergencyContact.label} value={a.client.emergencyContact} />
            </View>
          </View>
          <Choices label={fields.referral.label} choices={referralChoices} selected={a.client.referral} other={a.client.referralOther} />
        </Section>

        <Section number={2} section="skin">
          <Choices label={fields.concerns.label} choices={concernChoices} selected={a.skin.concerns} other={a.skin.concernsOther} />
          <View style={s.row}>
            <View style={s.cell}>
              <Field label={fields.previousTreatments.label} value={yesNo(a.skin.previousTreatments)} />
            </View>
            <View style={s.cell}>
              <Field label={fields.previousTreatmentsDetails.label} value={a.skin.previousTreatmentsDetails} />
            </View>
          </View>
          <Field label={fields.currentProducts.label} value={a.skin.currentProducts} />
          <Choices label={fields.skinType.label} choices={skinTypeChoices} selected={[a.skin.skinType]} columns={4} />
        </Section>

        <Section number={3} section="health">
          <Choices label={fields.conditions.label} choices={conditionChoices} selected={a.health.conditions} other={a.health.conditionsOther} />
          <View style={s.row}>
            <View style={s.cell}>
              <Field label={fields.medication.label} value={yesNo(a.health.medication)} />
            </View>
            <View style={s.cell}>
              <Field label={fields.medicationDetails.label} value={a.health.medicationDetails} />
            </View>
          </View>
          <Field label={fields.allergies.label} value={a.health.allergies} />
        </Section>

        <Section number={4} section="preferences">
          <Choices label={fields.interests.label} choices={interestChoices} selected={a.preferences.interests} other={a.preferences.interestsOther} />
          <View style={s.row}>
            <View style={s.cell}>
              <Field label={fields.goals.label} value={a.preferences.goals} />
            </View>
            <View style={s.cell}>
              <Field label={fields.avoid.label} value={a.preferences.avoid} />
            </View>
          </View>
          <Field label={fields.pressure.label} value={a.preferences.pressure ? labelOf(pressureChoices, a.preferences.pressure) : ''} />
        </Section>

        <Section number={5} section="consent">
          {consent.paragraphs.map((p) => (
            <Text key={p} style={s.paragraph}>
              {p}
            </Text>
          ))}
          <View style={{ marginTop: 6 }}>
            {consent.statements.map((st) => (
              <View key={st.id} style={s.choice} wrap={false}>
                <Check on={a.consent[st.id]} />
                <Text>{st.label}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section number={6} section="signature" intro="">
          <View style={s.row}>
            <View style={s.cell}>
              <Field label={fields.signedName.label} value={d.signedName} />
            </View>
            <View style={s.cell}>
              <Field label="Esthetician name" value={e?.estheticianName} />
            </View>
          </View>
          <View style={s.row}>
            <SignatureBox label={fields.signature.label} image={d.clientSignature} />
            <SignatureBox label="Esthetician signature" image={d.estheticianSignature} />
          </View>
          <View style={s.row}>
            <View style={s.cell}>
              <Field label={fields.date.label} value={d.signedAtLabel} />
            </View>
            <View style={s.cell}>
              <Field label={fields.date.label} value={d.estheticianSignedAtLabel} />
            </View>
          </View>
        </Section>

        <Section number={7} staff title="Skin analysis" intro="Mark areas of concern on the face maps and record your findings.">
          <View style={s.row}>
            <View style={s.faces}>
              <Face view="front" drawing={e?.faceMaps.front ?? null} />
              <Face view="profile" drawing={e?.faceMaps.profile ?? null} />
            </View>
            <View style={s.col}>
              {analysisFields.map((f) => (
                <Field key={f.id} label={f.label} value={e?.analysis[f.id]} />
              ))}
            </View>
          </View>
        </Section>

        <Section number={8} staff title="Treatment record" intro="">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 }}>
            {recordFields.map((f) => (
              // Short fields share a row; notes take the full width
              <View key={f.id} style={{ width: f.type === 'textarea' ? '100%' : '48%' }}>
                <Field label={f.label} value={f.type === 'date' ? formatDate(e?.record[f.id] ?? '') : e?.record[f.id]} />
              </View>
            ))}
          </View>
        </Section>

      </Page>
    </Document>
  );
}

export function renderConsentPdf(data: ConsentPdfData): Promise<Buffer> {
  return renderToBuffer(<ConsentDocument {...data} />);
}
