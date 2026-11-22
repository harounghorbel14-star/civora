import { NextResponse, type NextRequest } from 'next/server';
import { negotiateLang } from '@/lib/locales';
import { config } from '@/server/context';

/** "/" goes to the visitor's language (Accept-Language against the cell's locales; Arabic by default). */
export function GET(req: NextRequest): Response {
  return NextResponse.redirect(new URL(`/${negotiateLang(req.headers.get('accept-language'))}`, config().appOrigin), 307);
}
