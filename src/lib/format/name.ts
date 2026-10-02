/**
 * First name for greetings. Google names are often all caps ("LUIS") or all lowercase; those are
 * title-cased. Names with deliberate mixed case ("McKenzie", "DeShawn") are kept exactly as written.
 */
export function firstName(fullName: string | null | undefined): string {
  const first = fullName?.trim().split(/\s+/)[0] ?? '';
  if (first.length < 2 || (first !== first.toUpperCase() && first !== first.toLowerCase())) return first;
  return first
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}
