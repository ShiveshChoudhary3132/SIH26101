/* Export the framework, roles, officers and TPAC supplement from the
   browser data layer into server/seed_data.json, so the Python seeder
   has a single source of truth and nothing is re-typed by hand.

   Run: node tools/export-seed.mjs */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);

// the src files are plain browser scripts that hang everything off window
global.window = {};
for (const f of ['catalogue', 'data', 'nlp', 'engine']) {
  require(join(root, 'src', `${f}.js`));
}
const NX = global.window.NX;

const payload = {
  generatedAt: new Date().toISOString(),
  competencies: NX.COMPETENCIES.map((c) => ({
    id: c.id, domain: c.d, name: c.name, crit: c.crit, trend: c.trend, kw: c.kw
  })),
  domains: NX.DOMAINS,
  roles: NX.ROLES.map((r) => ({
    id: r.id, name: r.name, cadre: r.cadre, level: r.level, target: r.target
  })),
  officers: NX.OFFICERS.map((o) => ({
    id: o.id, name: o.name, role_id: o.role, posting: o.posting, station: o.station,
    exp: o.exp, batch: o.batch, qual: o.qual, bias: o.bias, seed: o.seed, note: o.note,
    trainings: o.trainings.map((t) => ({ course_id: t.c, completed_on: t.on + '-01', score: t.score }))
  })),
  tpacCourses: NX.TPAC_COURSES.map((c) => ({
    id: c.id, title: c.title, provider: c.provider, secs: c.secs,
    lang: c.lang, level: c.level, abstract: c.text, origin: 'tpac',
    cov: c.covRef || c.cov
  }))
};

mkdirSync(join(root, 'server'), { recursive: true });
writeFileSync(join(root, 'server', 'seed_data.json'), JSON.stringify(payload, null, 1));

console.log('competencies  ' + payload.competencies.length);
console.log('roles         ' + payload.roles.length);
console.log('officers      ' + payload.officers.length);
console.log('tpac courses  ' + payload.tpacCourses.length);
console.log('written       server/seed_data.json');
