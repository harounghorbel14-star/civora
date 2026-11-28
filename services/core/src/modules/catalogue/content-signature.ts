import { b64u, CredentialError, verifyJws } from '@civora/credentials';
import type { JWK } from 'jose';

/** The media type of a catalogue content signature (detached JWS, RFC 7515 appendix F). */
export const CONTENT_TYP = 'civora-catalogue-content+jws';

/**
 * Checks a published page against its signature (P5-SEC3): the canonical content is rebuilt by the caller (the
 * integrity monitor reads it from the database) and must verify under the content key.
 */
export async function verifyContent(canonical: string, signature: string, key: JWK): Promise<boolean> {
  const [h, empty, s] = signature.split('.');
  if (empty !== '' || !h || !s) return false;
  try {
    await verifyJws(`${h}.${b64u(canonical)}.${s}`, key, CONTENT_TYP);
    return true;
  } catch (e) {
    if (e instanceof CredentialError) return false;
    throw e;
  }
}
