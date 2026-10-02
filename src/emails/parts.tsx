import { Button, Column, Heading, Row, Section, Text } from '@react-email/components';
import { brand } from './EmailLayout';

export const emailStyles = {
  heading: {
    fontFamily: brand.serif,
    fontWeight: 400,
    fontSize: 30,
    lineHeight: '36px',
    color: brand.ink,
    textAlign: 'center' as const,
    margin: '16px 0 10px',
  },
  text: { fontSize: 15, lineHeight: '24px', color: brand.muted, margin: '0 0 12px' },
  small: { fontSize: 12, lineHeight: '18px', color: brand.bronze, margin: '8px 0 0' },
  button: {
    backgroundColor: brand.cocoa,
    color: brand.cream,
    borderRadius: 999,
    padding: '14px 28px',
    fontFamily: brand.serif,
    fontStyle: 'italic',
    fontSize: 18,
    textDecoration: 'none',
  },
};

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading as="h1" style={emailStyles.heading}>
      {children}
    </Heading>
  );
}

export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ textAlign: 'center', padding: '8px 0 16px' }}>
      <Button href={href} style={emailStyles.button}>
        {children}
      </Button>
    </Section>
  );
}

/** Label/value rows in a soft card */
export function DetailsTable({ rows }: { rows: [label: string, value: string][] }) {
  if (rows.length === 0) return null;
  return (
    <Section style={{ backgroundColor: brand.sand, borderRadius: 16, padding: '8px 20px', margin: '8px 0 20px' }}>
      {rows.map(([label, value], i) => (
        <Row key={label} style={{ borderTop: i === 0 ? 'none' : `1px solid ${brand.stone}` }}>
          <Column style={{ width: '36%', padding: '10px 0', fontSize: 13, color: brand.bronze, verticalAlign: 'top' }}>{label}</Column>
          <Column style={{ padding: '10px 0', fontSize: 14, color: brand.ink, verticalAlign: 'top', whiteSpace: 'pre-line' }}>{value}</Column>
        </Row>
      ))}
    </Section>
  );
}

export function Paragraph({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <Text style={{ ...emailStyles.text, ...style }}>{children}</Text>;
}
