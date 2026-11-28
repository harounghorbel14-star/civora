import { CredentialError } from './jws';

/**
 * Credential formats (P4-A2, P4-A4; doc phase-4/08). One place says which formats this release issues, holds and
 * verifies; every component asks it, so adding a format is adding an entry and its implementation, not finding every
 * hard-coded string. ISO mdoc (mDL) is planned and refused with a message that says so.
 */
export const FORMATS = {
  'dc+sd-jwt': {
    status: 'supported',
    standard: 'SD-JWT VC (IETF draft-ietf-oauth-sd-jwt-vc -26) over SD-JWT (RFC 9901), HAIP 1.0',
  },
  mso_mdoc: {
    status: 'planned',
    standard: 'ISO/IEC 18013-5 (mobile driving licence and other mdocs); ISO/IEC 18013-7 for presentation over the internet',
  },
} as const;

export type FormatId = keyof typeof FORMATS;
export type SupportedFormat = { [K in FormatId]: (typeof FORMATS)[K]['status'] extends 'supported' ? K : never }[FormatId];

/** The format, if this release supports it; otherwise a CredentialError('format') that says planned or unknown. */
export function supportedFormat(format: unknown): SupportedFormat {
  if (typeof format === 'string' && Object.hasOwn(FORMATS, format)) {
    const f = FORMATS[format as FormatId];
    if (f.status === 'supported') return format as SupportedFormat;
    throw new CredentialError('format', `${format} (${f.standard}) is planned, not supported in this release`);
  }
  throw new CredentialError('format', 'unknown credential format');
}
