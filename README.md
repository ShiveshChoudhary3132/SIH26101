# SAMARTH — SIH26101 prototype

**Problem statement:** Develop an AI-enabled learning platform that identifies competency gaps,
recommends personalised training through integration with the iGOT Karmayogi ecosystem, and
generates quizzes/MCQs from uploaded learning materials, to strengthen capacity building in
India's Official Statistical System.

**Team SPARK · TH108 · Smart Education · Software**

---

## Run it

Double-click `dist/samarth.html`. One file, no install, no server, no API keys. Loads in ~0.3s.

**Deploying?** See [DEPLOY.md](DEPLOY.md). Short version: Vercel alone hosts the whole working
app in about five minutes. Render + Neon are optional and add one thing — state that survives a
page refresh. The app degrades to local-session behaviour whenever the API is absent or asleep,
so the demo can never be broken by the venue network.

To work on the source:

```bash
python -m http.server 8731 --directory nexus
```

Rebuild the single-file version, and re-ingest the catalogue if `data/courses.json` changes:

```bash
node tools/ingest-igot.mjs data/courses.json && node build.mjs
```

---

## The catalogue is real

`data/courses.json` is the **iGOT Karmayogi platform export**. 761 records of
`primaryCategory: "Course"` go in; **758 modules** come out after dropping one placeholder
record and two duplicate titles. They span **91 contributing bodies** — ISTM, BSNL, Department
of Posts, NACIN, LBSNAA, ISB, UpGrad, Microsoft, NIC and others.

The export carries `name`, `description`, `duration`, `identifier` and `source`. It carries **no
competency tags, no proficiency level, no language flag and no engagement telemetry.** So:

| Field | Where it comes from |
|---|---|
| Title, provider, duration, identifier | Straight from the export, unmodified |
| Proficiency level | Derived at ingest from title register and contact time |
| Language | Derived from the presence of Devanagari (58 Hindi modules) |
| **Competency mapping** | **Derived at runtime** by the same TF-IDF engine that powers retrieval |
| Rating, enrolment counts | **Not shown.** The export has none and none are invented |

### The mapper is validated, not asserted

The 49 NSSTA TPAC programmes are an illustrative supplement (their metadata isn't published as
an API) and carry a **hand-authored** competency mapping. That mapping is held out as a test set:
the automatic mapper reproduces the human top-1 choice on **45 of 49 — 92% agreement**. The
number is computed live and shown on the Integration screen.

At a mapping floor of 0.18 cosine, **107 of 758 modules map** to the statistical competency
framework; **700 are retained unmapped rather than force-fitted**. Precision is deliberate: a
wrong recommendation to a serving officer costs more than a missing one.

### The finding that writes itself

**10 of 34 competencies have no live-catalogue coverage at all** — including Questionnaire Design
& Field Operations, Statistical Inference, Price Statistics (CPI/WPI/IIP), Time Series, and
Agricultural Statistics. The *What the live catalogue can serve* table on the Integration screen
ranks them. That is a procurement output for MoSPI, and it is the problem statement's own premise
demonstrated with its own data.

---

## The one thing to say in the pitch

**Nothing on any screen is a stored result.** Every number is computed in the browser from the
data layer. Switch the officer in the top-right and all 34 competency scores, the gap ranking,
the recommendation order and the workforce aggregates recompute. Paste your own document into
the Assessment Studio and it will generate a paper from text the system has never seen. The
course catalogue is the real iGOT export, mapped to competencies live.

---

## Suggested demo route (about 7 minutes)

| # | Screen | What to show | The line to say |
|---|--------|--------------|-----------------|
| 1 | **Overview** | Ananya Iyer, 71% readiness, 4 critical gaps | "One officer, one number, computed from her actual service record." |
| 2 | **Competency Profile** | The evidence panel | "Attainment is inferred from four signals — and the weights renormalise: no assessment evidence yet, so 30% becomes 37.5%. A new recruit is never scored as if they'd failed." |
| 3 | **Learning Path** | The bar under each score, then **Best matches in the live iGOT catalogue** | "Every recommendation shows what drove it. And this panel is the real catalogue — real `do_` identifiers, real providers." Then **Mark complete** and watch it re-rank. |
| 4 | **Assessment Studio** | Paste a judge's own document | "21 candidates built, 6 rejected by the validator, 10 shipped. Take it, then **Apply to competency profile**." |
| 5 | **Workforce Analytics** | Heatmap, then **Emerging skill demand** | "900 officials. Not what's short today — what will be short next year." |
| 6 | **iGOT Integration** | The five tiles, then **What the live catalogue can serve** | "758 modules ingested, 91 bodies, 107 auto-mapped, and the mapper agrees with our human mapping 92% of the time. And here's what iGOT *can't* serve — that's a procurement finding, not a bug." |

**Switch to Priya Nambiar** (lateral entry, M.Tech): strong on technology, thin on survey
methodology — the opposite gap signature to Ananya's, and the recommendations invert.

---

## Coverage of the detailed problem statement

34 competencies across the four domains the PS names, benchmarked against 8 role target
matrices, over an **807-module catalogue** (758 live iGOT + 49 NSSTA TPAC).

| PS domain | Covered as |
|---|---|
| Statistical | Survey design & sampling, questionnaire & field ops, inference, price statistics (CPI/WPI/IIP), national accounts, time series, data quality frameworks, labour statistics, agricultural statistics, industrial & enterprise statistics, SDG indicator framework, metadata standards |
| Technical | Python, R/STATA/SPSS/SAS, SQL, big data platforms, ML & AI, GIS & spatial, visualisation & dashboarding |
| Digital Governance | e-Office & digital signatures, DPDP Act 2023 & privacy, cybersecurity, open data & APIs/NDAP, government cloud (MeghRaj), responsible AI, digital public infrastructure |
| Behavioural & Managerial | Leadership & field supervision, stakeholder engagement, project management, ethics & integrity, technical report writing, data storytelling, evidence-based decision making, change management |

### What is actually implemented

| Claim on the slide | How it works here |
|---|---|
| AI competency assessment | 34 competencies × 8 role matrices; attainment inferred from self-assessment, qualifications, recency-decayed training history and assessment scores, weights renormalised over available evidence |
| Automated skill-gap analysis | Shortfall against the role matrix weighted by mission criticality; ranked gaps and one comparable readiness figure |
| Seamless iGOT integration | The real platform export, ingested and auto-mapped; endpoint surface, field mapping, OAuth2/Parichay SSO model and a rationale-carrying enrolment payload |
| Semantic course matching | TF-IDF vector space over the catalogue, cosine retrieval against a gap-derived query vector |
| Re-ranking | 0.40 semantic + 0.26 coverage + 0.14 role fit + 0.12 peer + 0.08 effort efficiency, each contribution retained and rendered |
| Collaborative filtering | Item-based CF over 900 deterministic synthetic officers; peer signal is completion frequency among the 80 nearest gap signatures |
| iGOT + NSSTA TPAC recommendations | One ranked list across both sources, provenance tagged on every row, plus a live-catalogue-only panel |
| MCQ generation from uploads | Six question forms, distractors in a controlled plausibility band, magnitude-preserving numeric distractors |
| Validation | Rejects duplicate options, length cues, short stems, dangling references; survivors graded for difficulty, Bloom level, discrimination, confidence |
| Continuous feedback | Completions and quiz scores write back into the attainment vector; readiness and ranking both move |
| Learner + administrator dashboards | Four officer screens, three institutional screens, one engine |
| Predictive analytics | Emerging skill demand = gap × criticality × technology-adoption pace, with headcount affected |

### Honest limits

- The catalogue is a **real export, not a live API connection**. The sync animation is
  illustrative; everything downstream of the catalogue is real computation.
- The 900-officer workforce is **synthetic but deterministic** (seeded PRNG), because no real
  HRMS extract exists. Officer profiles are illustrative personas.
- The 49 **NSSTA TPAC programmes are illustrative** — written to represent programmes NSSTA
  actually runs, since TPAC metadata is not published. They are tagged separately everywhere and
  never presented as export data.
- Semantic retrieval uses **TF-IDF**, not sentence embeddings. Production swaps in Sentence-BERT
  over FAISS/pgvector; the interface is unchanged.
- Question stems are **extractive**. Production adds an LLM pass for fluency — the extraction,
  distractor and validation stages stay, because they are what makes the output auditable.
- The **AI virtual assistant, virtual labs, adaptive sequencing and UI localisation** in the PS
  are not built. *How It Works → Beyond this prototype* lists them with honest status.
- PDF upload uses pdf.js and needs the CDN; `.txt`, `.md` and paste always work offline.

---

## Layout

```
nexus/
  index.html                dev entry (loads src/*.js)
  build.mjs                 inlines everything into dist/
  data/courses.json         the iGOT Karmayogi platform export
  tools/ingest-igot.mjs     normalises the export -> src/catalogue.js
  dist/
    samarth.html                standalone, double-clickable
    samarth-artifact.html       body fragment for web publishing
  src/
    catalogue.js      GENERATED — 758 normalised iGOT modules
    data.js           competency framework, role matrices, TPAC supplement, officers, material
    nlp.js            tokeniser, stemmer, TF-IDF space, key-phrase extraction, readability
    engine.js         attainment inference, gap scoring, auto-mapping, recommender, CF, analytics
    mcq.js            question generation, distractors, validator, difficulty grading
    charts.js         hand-drawn SVG: radar, bars, columns, line, gauge, donut, heat scale
    app.js            shell, state, router
    views-*.js        the seven screens
    styles.css        design tokens and components
```

No runtime dependencies. pdf.js is the only external script, and it is optional.
