import { describe, expect, it } from 'vitest';
import { firstName } from './name';

describe('firstName', () => {
  it.each([
    ['LUIS FERNANDO VIVAS', 'Luis'],
    ['maria lopez', 'Maria'],
    ['Luis Fernando', 'Luis'],
    ['McKenzie Ray', 'McKenzie'],
    ['JEAN-PAUL SMITH', 'Jean-Paul'],
    ["O'NEIL", "O'Neil"],
    ['ÁNGELA', 'Ángela'],
    ['  ana  ', 'Ana'],
    ['', ''],
    [null, ''],
  ])('%j -> %j', (input, expected) => {
    expect(firstName(input)).toBe(expected);
  });
});
