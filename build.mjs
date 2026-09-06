/* Inline every source file into single-file builds.
   dist/samarth.html          — standalone, double-clickable
   dist/samarth-artifact.html — body fragment for Artifact publishing */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

const SCRIPTS = [
  'src/catalogue.js', 'src/data.js', 'src/nlp.js', 'src/engine.js', 'src/charts.js', 'src/mcq.js', 'src/api.js',
  'src/app.js', 'src/views-learner.js', 'src/views-studio.js', 'src/views-system.js'
];

const HEAD = `<title>SAMARTH</title>
<meta name="description" content="AI competency-gap analysis, personalised iGOT Karmayogi training paths and automatic MCQ generation for India's Official Statistical System.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500;600&display=swap">
<style>
${read('src/styles.css')}
</style>`;

/* Optional persistence backend. Set SAMARTH_API_URL at build time
   (Vercel: Project Settings -> Environment Variables). Left unset, the
   build is fully self-contained and makes no network calls of its own. */
const API_URL = (process.env.SAMARTH_API_URL || '').replace(/\/+$/, '');
const API_TAG = API_URL
  ? `<script>window.SAMARTH_API=${JSON.stringify(API_URL)};<\/script>
`
  : '';

/* Official iGOT Karmayogi mark. Drop the file in as assets/karmayogi-logo.png
   (or .svg) and it is inlined as a data URI, so the single-file build stays
   self-contained and works with no network at all. Absent, the lockup is
   simply omitted rather than showing a broken image. */
const LOGO_CANDIDATES = [
  ['assets/karmayogi-logo.svg', 'image/svg+xml'],
  ['assets/karmayogi-logo.png', 'image/png'],
  ['assets/karmayogi-logo.jpg', 'image/jpeg']
];
let LOGO_TAG = '';
let logoNote = '(none - drop assets/karmayogi-logo.png to add it)';
for (const [rel, mime] of LOGO_CANDIDATES) {
  if (!existsSync(join(here, rel))) continue;
  const b64 = readFileSync(join(here, rel)).toString('base64');
  LOGO_TAG = `<script>window.SAMARTH_IGOT_LOGO=${JSON.stringify(`data:${mime};base64,${b64}`)};<\/script>\n`;
  logoNote = `${rel} (${Math.round(b64.length / 1365)} KB inlined)`;
  break;
}

const BODY = `${API_TAG}${LOGO_TAG}<div id="root"></div>
<div class="toasts" id="toasts" aria-live="polite"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>
<script>
try {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
} catch (e) { /* PDF upload stays unavailable; paste still works */ }
<\/script>

<script>
${SCRIPTS.map((p) => `/* ===== ${p} ===== */\n${read(p)}`).join('\n\n')}

window.NX.app.boot();
<\/script>`;

mkdirSync(join(here, 'dist'), { recursive: true });

writeFileSync(join(here, 'dist/samarth.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1">\n${HEAD}\n</head>\n<body>\n${BODY}\n</body>\n</html>\n`);

writeFileSync(join(here, 'dist/samarth-artifact.html'), `${HEAD}\n\n${BODY}\n`);

// Vercel serves dist/ as the site root
copyFileSync(join(here, 'dist/samarth.html'), join(here, 'dist/index.html'));

const kb = (p) => (readFileSync(join(here, p)).length / 1024).toFixed(0);
console.log(`built  dist/index.html            ${kb('dist/index.html')} KB  (Vercel entry)`);
console.log(`built  dist/samarth.html          ${kb('dist/samarth.html')} KB  (standalone)`);
console.log(`built  dist/samarth-artifact.html ${kb('dist/samarth-artifact.html')} KB`);
console.log(`api    ${API_URL || '(none - fully offline build)'}`);
console.log(`logo   ${logoNote}`);
