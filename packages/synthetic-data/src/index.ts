import { addWorkingDays, loadCountryPack, type LoadedPack, workingDaysBetween } from '@civora/country-packs';
import { BRANCH_CITIES, FAMILY_NAMES, GIVEN_NAMES } from './names';

/** Deterministic PRNG (mulberry32) so that the same seed always yields the same data set. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticOptions {
  seed: number;
  tenants: number;
  casesPerTenant: number;
  /** Reference "today" for statuses; default 2026-11-18 for reproducibility. */
  today?: string;
  packId?: string;
}

export interface SyntheticTenant { id: string; synthetic: true; name: string; kind: 'bank-resident' | 'leasing' | 'payment-institution'; rulePack: string; }
export interface SyntheticCustomer { id: string; synthetic: true; tenantId: string; type: 'individual' | 'company'; displayName: { ar: string; fr: string }; gender: 'F' | 'M' | null; ageBand: '18-25' | '26-60' | '60+' | null; cin: string | null; phone: string; email: string; }
export interface SyntheticCase {
  id: string; synthetic: true; tenantId: string; reference: string; customerId: string;
  caseType: 'complaint' | 'service-request' | 'information-request'; subject: string; channel: 'email' | 'online-form' | 'branch' | 'post';
  branch: string; receivedOn: string; acknowledgedOn: string; regulatoryDueOn: string | null; status: 'received' | 'in-analysis' | 'information-requested' | 'decided'; decidedOn: string | null;
  outcome: 'upheld' | 'partially-upheld' | 'rejected' | null; description: string;
}
export interface SyntheticDataset { generatedWith: { seed: number; packId: string; packDigest: string; today: string }; tenants: SyntheticTenant[]; customers: SyntheticCustomer[]; cases: SyntheticCase[]; }

const DESCRIPTIONS: Record<string, string> = {
  financing: 'Échéancier de crédit contesté (texte fictif).',
  'non-card-payment': 'Virement non reçu par le bénéficiaire (texte fictif).',
  'card-payment': 'Paiement par carte contesté (texte fictif).',
  'account-operation': 'Frais de tenue de compte contestés (texte fictif).',
  'international-operations': "Retard d'un transfert de l'étranger (texte fictif).",
  pricing: 'Commission jugée non conforme au barème (texte fictif).',
  'remote-banking': "Accès impossible à l'application mobile (texte fictif).",
  'other-services': 'Autre réclamation (texte fictif).',
};

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)] as T;
}
function digits(r: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(r() * 10).toString();
  return s;
}
function uuidFrom(r: () => number): string {
  const h = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function minusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function generate(opts: SyntheticOptions, loaded: LoadedPack = loadCountryPack(opts.packId ?? 'tn')): SyntheticDataset {
  const r = rng(opts.seed);
  const today = opts.today ?? '2026-11-18';
  const { pack, rulePacks, digest } = loaded;
  const kinds: SyntheticTenant['kind'][] = ['bank-resident', 'leasing', 'payment-institution'];
  const tenants: SyntheticTenant[] = [];
  const customers: SyntheticCustomer[] = [];
  const cases: SyntheticCase[] = [];
  for (let t = 0; t < opts.tenants; t++) {
    const kind = kinds[t % kinds.length] as SyntheticTenant['kind'];
    const rulePack = kind === 'payment-institution' ? 'RP-BCT-2026-10' : 'RP-BCT-2022-08';
    const tenant: SyntheticTenant = { id: uuidFrom(r), synthetic: true, name: `${{ 'bank-resident': 'Banque', leasing: 'Leasing', 'payment-institution': 'Paiement' }[kind]} Exemple ${t + 1} (fictif)`, kind, rulePack };
    tenants.push(tenant);
    const rp = rulePacks[rulePack];
    const subjects = rp?.subjects?.length ? rp.subjects : Object.keys(DESCRIPTIONS);
    for (let c = 0; c < opts.casesPerTenant; c++) {
      const isCompany = r() < 0.15;
      const given = pick(r, GIVEN_NAMES);
      const family = pick(r, FAMILY_NAMES);
      const customer: SyntheticCustomer = {
        id: uuidFrom(r), synthetic: true, tenantId: tenant.id, type: isCompany ? 'company' : 'individual',
        displayName: isCompany ? { ar: `شركة ${family.ar} (وهمية)`, fr: `Société ${family.fr} (fictive)` } : { ar: `${given.ar} ${family.ar}`, fr: `${given.fr} ${family.fr}` },
        gender: isCompany ? null : (given.g as 'F' | 'M'), ageBand: isCompany ? null : pick(r, ['18-25', '26-60', '26-60', '26-60', '60+'] as const),
        cin: isCompany ? null : `99${digits(r, 6)}`,
        phone: `+2160${digits(r, 7)}`,
        email: `client${c + 1}.t${t + 1}@synthetic.invalid`,
      };
      customers.push(customer);
      const typeRoll = r();
      const caseType: SyntheticCase['caseType'] = typeRoll < 0.75 ? 'complaint' : typeRoll < 0.9 ? 'service-request' : 'information-request';
      const receivedOn = minusDays(today, Math.floor(r() * 60));
      const ceiling = rp?.deadline.ceiling ?? null;
      const due = caseType === 'complaint' && ceiling ? addWorkingDays(receivedOn, ceiling, pack.calendar) : null;
      const age = workingDaysBetween(receivedOn, today, pack.calendar);
      const decided = age > 3 && r() < 0.7;
      const decidedOn = decided ? addWorkingDays(receivedOn, Math.max(1, Math.min(age, 1 + Math.floor(r() * 18))), pack.calendar) : null;
      const subject = pick(r, subjects);
      cases.push({
        id: uuidFrom(r), synthetic: true, tenantId: tenant.id, reference: `SYN-RC-${t + 1}-${String(c + 1).padStart(5, '0')}`, customerId: customer.id,
        caseType, subject, channel: pick(r, ['email', 'online-form', 'branch', 'branch', 'post'] as const), branch: pick(r, BRANCH_CITIES),
        receivedOn, acknowledgedOn: receivedOn, regulatoryDueOn: due,
        status: decided ? 'decided' : pick(r, ['received', 'in-analysis', 'in-analysis', 'information-requested'] as const),
        decidedOn, outcome: decided ? pick(r, ['upheld', 'partially-upheld', 'rejected'] as const) : null,
        description: DESCRIPTIONS[subject] ?? 'Texte fictif.',
      });
    }
  }
  return { generatedWith: { seed: opts.seed, packId: pack.packId, packDigest: digest, today }, tenants, customers, cases };
}
