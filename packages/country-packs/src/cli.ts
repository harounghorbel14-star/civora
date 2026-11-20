import { join } from 'node:path';
import { buildManifest, DEFAULT_PACKS_DIR, loadCountryPack } from './index';

const [cmd, packId = 'tn'] = process.argv.slice(2);
if (cmd === 'manifest') {
  const m = buildManifest(join(DEFAULT_PACKS_DIR, packId));
  console.log(`manifest written: ${Object.keys(m.files).length} files, digest ${m.digest}`);
} else if (cmd === 'verify') {
  const { pack, rulePacks, digest } = loadCountryPack(packId);
  console.log(`pack ${pack.packId}@${pack.version} OK (${pack.status}); rule packs: ${Object.keys(rulePacks).join(', ')}; digest ${digest}`);
} else {
  console.error('usage: cli.js manifest|verify <packId>');
  process.exit(2);
}
