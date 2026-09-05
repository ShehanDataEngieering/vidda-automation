// Vidda brand palette — espresso / cream / amber.
// Kept separate from the shadcn semantic tokens (--primary, --destructive, etc. in index.css)
// so status colors elsewhere in the app (risk levels, compliance state) stay untouched.
// Use these directly (as inline styles or arbitrary Tailwind values) for brand-specific
// surfaces: the logo, marketing/hero sections, and decorative panels.
export const brand = {
  espresso: '#1D1007',
  espressoLight: '#2B1A0E',
  cream: '#F4F3EA',
  creamText: '#E8DEC8',
  creamTextBright: '#F5EBD7',
  amber: '#EC9A29',
  amberLight: '#EAAD56',
} as const;
