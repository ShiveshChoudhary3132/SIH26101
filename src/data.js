/* ===========================================================
   SAMARTH · data layer
   Competency frameworks, role matrices, iGOT-style catalogue,
   officer profiles and sample learning material.
   Everything downstream is COMPUTED from this — nothing in the
   dashboards is a hard-coded result.
   =========================================================== */
var NX = window.NX || {};
window.NX = NX;

/* ---------- deterministic PRNG (mulberry32) ---------- */
NX.rng = function (seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ---------- 1. Competency framework ----------
   Four domains mirroring the Karmayogi competency model as
   adapted for the Official Statistical System.
   crit = mission criticality weight (1 routine … 3 critical)  */
NX.DOMAINS = [
  { id: 'STAT', name: 'Statistical Foundations', short: 'Statistical', hue: 'accent' },
  { id: 'TECH', name: 'Data & Technology', short: 'Technical', hue: 'info' },
  { id: 'DIGI', name: 'Digital Governance', short: 'Digital', hue: 'warn' },
  { id: 'BEHV', name: 'Behavioural & Managerial', short: 'Managerial', hue: 'good' }
];

NX.COMPETENCIES = [
  { id: 'STAT-01', d: 'STAT', name: 'Survey Design & Sampling Methodology', crit: 3, trend: 1.0, kw: 'sampling frame stratification multistage design probability proportional size estimator survey' },
  { id: 'STAT-02', d: 'STAT', name: 'Questionnaire Design & Field Operations', crit: 2, trend: 0.9, kw: 'questionnaire schedule field investigator canvassing respondent non-response enumeration' },
  { id: 'STAT-03', d: 'STAT', name: 'Statistical Inference & Hypothesis Testing', crit: 3, trend: 1.0, kw: 'inference confidence interval hypothesis significance variance estimation standard error' },
  { id: 'STAT-04', d: 'STAT', name: 'Price Statistics — CPI, WPI, IIP', crit: 3, trend: 1.0, kw: 'index number consumer price wholesale industrial production laspeyres weight base year inflation' },
  { id: 'STAT-05', d: 'STAT', name: 'National Accounts & GDP Compilation', crit: 3, trend: 1.0, kw: 'national accounts gross domestic product value added supply use table gva compilation' },
  { id: 'STAT-06', d: 'STAT', name: 'Time Series Analysis & Forecasting', crit: 2, trend: 1.1, kw: 'time series seasonal adjustment arima trend forecasting nowcasting decomposition' },
  { id: 'STAT-07', d: 'STAT', name: 'Data Quality, Editing & Imputation', crit: 3, trend: 1.2, kw: 'data quality editing imputation outlier consistency validation error rate framework' },
  { id: 'STAT-08', d: 'STAT', name: 'Labour Statistics & Employment Indicators', crit: 3, trend: 1.1, kw: 'labour force employment unemployment worker participation activity status plfs wages' },
  { id: 'STAT-09', d: 'STAT', name: 'Agricultural & Rural Statistics', crit: 2, trend: 1.0, kw: 'agriculture crop yield area estimation cultivation land use livestock rural harvest' },
  { id: 'STAT-10', d: 'STAT', name: 'Industrial & Enterprise Statistics', crit: 2, trend: 1.0, kw: 'industry factory enterprise annual survey manufacturing business register establishment' },
  { id: 'STAT-11', d: 'STAT', name: 'SDG Indicators & National Indicator Framework', crit: 2, trend: 1.2, kw: 'sustainable development goals indicator framework target monitoring disaggregation reporting' },
  { id: 'STAT-12', d: 'STAT', name: 'Metadata Standards & Statistical Documentation', crit: 2, trend: 1.3, kw: 'metadata standard sdmx ddi documentation concept definition provenance data dictionary' },

  { id: 'TECH-01', d: 'TECH', name: 'Python for Statistical Computing', crit: 3, trend: 1.5, kw: 'python pandas numpy scripting automation notebook statistical computing' },
  { id: 'TECH-02', d: 'TECH', name: 'R, STATA, SPSS & SAS Proficiency', crit: 2, trend: 0.9, kw: 'r stata spss sas syntax survey package weighting analysis software' },
  { id: 'TECH-03', d: 'TECH', name: 'SQL & Database Management', crit: 3, trend: 1.3, kw: 'sql database query join relational schema postgres warehouse indexing' },
  { id: 'TECH-04', d: 'TECH', name: 'Big Data Platforms (Spark / Hadoop)', crit: 1, trend: 1.4, kw: 'big data spark hadoop distributed cluster pipeline scalable processing' },
  { id: 'TECH-05', d: 'TECH', name: 'Machine Learning & AI for Official Statistics', crit: 2, trend: 1.6, kw: 'machine learning artificial intelligence model classification regression training feature prediction' },
  { id: 'TECH-06', d: 'TECH', name: 'GIS & Spatial Statistics', crit: 1, trend: 1.3, kw: 'gis spatial geospatial mapping coordinates shapefile small area estimation' },
  { id: 'TECH-07', d: 'TECH', name: 'Data Visualisation & Dashboarding', crit: 2, trend: 1.4, kw: 'visualisation dashboard chart plot reporting bi tableau interactive' },

  { id: 'DIGI-01', d: 'DIGI', name: 'e-Office, Digital Signatures & File Workflow', crit: 2, trend: 0.9, kw: 'e-office digital file noting draft workflow paperless signature certificate dsc' },
  { id: 'DIGI-02', d: 'DIGI', name: 'DPDP Act 2023 & Data Privacy', crit: 3, trend: 1.5, kw: 'privacy dpdp personal data fiduciary consent anonymisation confidentiality disclosure' },
  { id: 'DIGI-03', d: 'DIGI', name: 'Cybersecurity Hygiene', crit: 2, trend: 1.4, kw: 'cybersecurity password phishing incident cert-in access control audit' },
  { id: 'DIGI-04', d: 'DIGI', name: 'Open Data, APIs & NDAP Publishing', crit: 2, trend: 1.3, kw: 'open data api ndap metadata catalogue machine readable dissemination portal' },
  { id: 'DIGI-05', d: 'DIGI', name: 'Government Cloud (MeghRaj)', crit: 1, trend: 1.3, kw: 'cloud meghraj nic server hosting virtual machine deployment infrastructure' },
  { id: 'DIGI-06', d: 'DIGI', name: 'Responsible AI & Algorithmic Ethics', crit: 2, trend: 1.6, kw: 'artificial intelligence ethics bias fairness transparency accountability algorithm' },
  { id: 'DIGI-07', d: 'DIGI', name: 'Digital Public Infrastructure', crit: 2, trend: 1.5, kw: 'digital public infrastructure aadhaar upi digilocker consent manager registry interoperable india stack' },

  { id: 'BEHV-01', d: 'BEHV', name: 'Team Leadership & Field Supervision', crit: 2, trend: 0.9, kw: 'leadership supervision team motivation delegation field staff mentoring' },
  { id: 'BEHV-02', d: 'BEHV', name: 'Inter-Ministerial Stakeholder Engagement', crit: 2, trend: 1.0, kw: 'stakeholder coordination ministry engagement negotiation liaison committee' },
  { id: 'BEHV-03', d: 'BEHV', name: 'Survey Round & Project Management', crit: 3, trend: 1.0, kw: 'project management schedule milestone budget risk survey round planning' },
  { id: 'BEHV-04', d: 'BEHV', name: 'Professional Ethics & Statistical Integrity', crit: 3, trend: 1.1, kw: 'ethics integrity impartiality code conduct professional independence trust' },
  { id: 'BEHV-05', d: 'BEHV', name: 'Technical Report Writing', crit: 2, trend: 0.9, kw: 'report writing documentation drafting technical note methodology annexure' },
  { id: 'BEHV-06', d: 'BEHV', name: 'Data Storytelling & Public Communication', crit: 1, trend: 1.1, kw: 'communication storytelling presentation media briefing public narrative' },
  { id: 'BEHV-07', d: 'BEHV', name: 'Evidence-Based Decision Making', crit: 3, trend: 1.2, kw: 'decision making evidence judgement uncertainty option appraisal bias policy choice' },
  { id: 'BEHV-08', d: 'BEHV', name: 'Change Management', crit: 2, trend: 1.3, kw: 'change management adoption resistance transition reform rollout sustaining practice' }
];

NX.compIndex = {};
NX.COMPETENCIES.forEach(function (c, i) { NX.compIndex[c.id] = i; c.idx = i; });
NX.NC = NX.COMPETENCIES.length;

/* ---------- 2. Role → target proficiency matrix ----------
   Levels: 1 Aware · 2 Working · 3 Practitioner · 4 Proficient · 5 Expert
   Order matches NX.COMPETENCIES.                                    */
function T(s) { return s.split(',').map(Number); }

NX.ROLES = [
  { id: 'ISS-DD', name: 'Deputy Director', cadre: 'Indian Statistical Service', level: 'Group A - JTS/STS',
    target: T('5,4,5,4,4,4,4,4,3,3,4,4, 4,4,3,2,3,2,4, 3,4,3,4,3,3,3, 4,4,5,5,4,3,4,3'.replace(/ /g, '')) },
  { id: 'ISS-DIR', name: 'Director', cadre: 'Indian Statistical Service', level: 'Group A - JAG',
    target: T('5,4,5,5,5,4,4,4,4,4,5,4, 3,3,3,2,3,2,4, 4,5,4,5,3,4,4, 5,5,5,5,5,5,5,5'.replace(/ /g, '')) },
  { id: 'SSS-JSO', name: 'Junior Statistical Officer', cadre: 'Subordinate Statistical Service', level: 'Group B',
    target: T('3,4,3,3,2,2,4,3,3,3,2,3, 3,3,3,1,2,2,3, 3,3,3,2,2,2,2, 2,2,3,4,3,2,2,2'.replace(/ /g, '')) },
  { id: 'SSS-SSO', name: 'Senior Statistical Officer', cadre: 'Subordinate Statistical Service', level: 'Group B - Gazetted',
    target: T('4,4,4,4,3,3,4,4,3,4,3,4, 3,3,4,2,2,2,4, 3,4,3,3,3,2,3, 4,3,4,5,4,3,3,3'.replace(/ /g, '')) },
  { id: 'NSSO-FI', name: 'Field Investigator', cadre: 'NSSO Field Operations Division', level: 'Group C - Grade I',
    target: T('3,5,2,2,1,1,4,3,3,3,1,2, 2,2,2,1,1,3,2, 3,3,3,2,2,1,2, 3,3,3,5,2,2,2,2'.replace(/ /g, '')) },
  { id: 'DES-SO', name: 'Statistical Officer, State DES', cadre: 'State Directorate of Economics & Statistics', level: 'State Cadre',
    target: T('4,4,3,4,3,3,4,3,4,3,4,3, 3,3,3,2,2,3,4, 3,4,3,4,3,2,3, 3,4,4,4,4,3,4,3'.replace(/ /g, '')) },
  { id: 'MOSPI-DA', name: 'Data Analyst, Data Informatics', cadre: 'MoSPI - NDAP', level: 'Technical',
    target: T('3,2,4,3,3,4,4,3,2,3,3,5, 5,4,5,4,5,3,5, 3,5,4,5,4,5,4, 2,3,3,4,3,4,4,2'.replace(/ /g, '')) },
  { id: 'NSSTA-FAC', name: 'Training Faculty', cadre: 'National Statistical Systems Training Academy', level: 'Faculty',
    target: T('5,4,5,4,4,4,5,4,4,4,4,5, 4,4,3,2,3,2,4, 3,4,3,4,3,4,3, 4,4,4,5,5,5,4,5'.replace(/ /g, '')) }
];
NX.roleById = {};
NX.ROLES.forEach(function (r) { NX.roleById[r.id] = r; });

NX.LEVEL_NAMES = ['—', 'Aware', 'Working', 'Practitioner', 'Proficient', 'Expert'];

/* ---------- 3. Qualifications & their competency signal ---------- */
NX.QUALS = {
  'M.Sc. Statistics': { STAT: 4.4, TECH: 2.8, DIGI: 1.6, BEHV: 2.0 },
  'M.Stat (ISI)': { STAT: 4.8, TECH: 3.4, DIGI: 1.8, BEHV: 2.0 },
  'M.A. Economics': { STAT: 3.4, TECH: 2.0, DIGI: 1.6, BEHV: 2.8 },
  'M.Phil. Economics': { STAT: 3.8, TECH: 2.2, DIGI: 1.8, BEHV: 3.4 },
  'M.Tech. Data Science': { STAT: 3.0, TECH: 4.7, DIGI: 3.6, BEHV: 1.8 },
  'MCA': { STAT: 2.0, TECH: 4.2, DIGI: 3.4, BEHV: 1.8 },
  'B.Sc. Mathematics': { STAT: 2.6, TECH: 1.8, DIGI: 1.4, BEHV: 1.4 },
  'B.A. Economics': { STAT: 2.0, TECH: 1.4, DIGI: 1.4, BEHV: 1.8 },
  'PGDM Public Policy': { STAT: 2.4, TECH: 1.6, DIGI: 2.4, BEHV: 3.8 }
};

/* ---------- 4. iGOT Karmayogi course catalogue (mirror) ----------
   `cov` = competencies advanced, with contribution weight 0-1.
   `text` feeds the TF-IDF semantic index — it is the real course
   abstract the recommender reads.                                  */
function C(id, title, provider, hours, level, rating, learners, lang, cov, text) {
  return { id: id, title: title, provider: provider, hours: hours, level: level,
    rating: rating, learners: learners, lang: lang, cov: cov, text: text };
}

NX.TPAC_COURSES = [
  C('KM-1042', 'Foundations of Survey Sampling for Official Statistics', 'NSSTA', 24, 2, 4.6, 8420, 'EN / HI',
    { 'STAT-01': 1.0, 'STAT-03': 0.4, 'STAT-02': 0.3 },
    'Probability sampling frames, stratification and multistage design as applied in National Sample Survey rounds. Covers selection with probability proportional to size, systematic circular sampling, sub-sample independence and the construction of design weights and multipliers for household and enterprise surveys.'),
  C('KM-1077', 'Advanced Estimation Theory and Variance Computation', 'ISI Kolkata', 36, 4, 4.4, 2130, 'EN',
    { 'STAT-03': 1.0, 'STAT-01': 0.6 },
    'Ratio and regression estimators, calibration weighting and design based variance estimation for complex survey designs. Introduces linearisation, jackknife and bootstrap replication methods to compute standard errors and confidence intervals from stratified multistage samples.'),
  C('KM-1103', 'Questionnaire Design and Field Canvassing Discipline', 'NSSTA', 16, 2, 4.5, 11250, 'EN / HI',
    { 'STAT-02': 1.0, 'BEHV-04': 0.3, 'STAT-07': 0.3 },
    'Designing schedules that minimise respondent burden and measurement error. Question wording, recall periods, skip logic, probing technique, handling refusals and partial non response during household enumeration in rural and urban blocks.'),
  C('KM-1150', 'Consumer Price Index: Compilation and Interpretation', 'NSSTA', 20, 3, 4.7, 5610, 'EN / HI',
    { 'STAT-04': 1.0, 'STAT-06': 0.3 },
    'Construction of the Consumer Price Index using the Laspeyres formula, item basket selection, weighting diagrams derived from consumption expenditure surveys, price collection protocols, quality adjustment, base year revision and linking of index series.'),
  C('KM-1162', 'Index of Industrial Production and Wholesale Prices', 'MoSPI', 18, 3, 4.2, 3180, 'EN',
    { 'STAT-04': 0.9, 'STAT-06': 0.3, 'STAT-07': 0.2 , 'STAT-10': 0.5 },
    'Compilation of the Index of Industrial Production and the Wholesale Price Index. Item basket, source agencies, response follow up, seasonal factors, revision policy and the interpretation of month on month versus year on year movement.'),
  C('KM-1210', 'National Accounts Statistics: Concepts and Compilation', 'NSSTA', 40, 4, 4.5, 2960, 'EN',
    { 'STAT-05': 1.0, 'STAT-04': 0.3, 'BEHV-05': 0.2 },
    'System of National Accounts framework, gross value added by economic activity, supply and use tables, production and expenditure approaches to gross domestic product, deflation to constant prices and the treatment of the unorganised sector.'),
  C('KM-1246', 'Quarterly GDP Estimation and Benchmark Indicators', 'MoSPI', 22, 5, 4.3, 940, 'EN',
    { 'STAT-05': 0.9, 'STAT-06': 0.6 },
    'Benchmark indicator method for quarterly gross domestic product, extrapolation using high frequency indicators, temporal disaggregation, benchmarking to annual estimates and reconciliation of revisions across successive releases.'),
  C('KM-1288', 'Time Series Analysis and Seasonal Adjustment', 'ISI Kolkata', 30, 4, 4.4, 1870, 'EN',
    { 'STAT-06': 1.0, 'TECH-02': 0.4, 'STAT-03': 0.3 },
    'Trend cycle decomposition, stationarity testing, ARIMA modelling and X-13ARIMA-SEATS seasonal adjustment of official series. Includes outlier detection, calendar and festival effects specific to Indian economic series and forecasting evaluation.'),
  C('KM-1320', 'Data Editing, Validation and Imputation Techniques', 'NSSTA', 18, 3, 4.6, 6740, 'EN / HI',
    { 'STAT-07': 1.0, 'TECH-01': 0.3 },
    'Selective editing, Fellegi Holt consistency rules, outlier detection and hot deck and model based imputation of missing values. Building automated validation suites and measuring the impact of editing on published estimates.'),
  C('KM-1355', 'Small Area Estimation for District Level Statistics', 'ISI Kolkata', 26, 5, 4.1, 620, 'EN',
    { 'STAT-03': 0.7, 'TECH-06': 0.8, 'TECH-05': 0.5 },
    'Direct and model assisted small area estimators, Fay Herriot area level models and empirical best linear unbiased prediction to produce reliable district level indicators when survey sample sizes are inadequate.'),

  C('KM-2010', 'Python for Statistical Computing', 'iGOT Karmayogi', 28, 2, 4.7, 19340, 'EN / HI',
    { 'TECH-01': 1.0, 'TECH-07': 0.4, 'STAT-07': 0.3 },
    'Programming with Python for statistical work: pandas data frames, numpy arrays, reading survey microdata, applying design weights, group aggregation, reproducible notebooks and scripting repetitive tabulation tasks.'),
  C('KM-2035', 'Automating Survey Tabulation with pandas', 'MoSPI', 14, 3, 4.5, 4210, 'EN',
    { 'TECH-01': 0.9, 'STAT-07': 0.4, 'TECH-07': 0.3 },
    'Turning manual spreadsheet tabulation into repeatable Python pipelines. Weighted cross tabulation, multi index reshaping, unit level to estimate level workflows and automated generation of standard statement tables.'),
  C('KM-2064', 'R and the survey Package for Complex Designs', 'ISI Kolkata', 22, 3, 4.3, 2480, 'EN',
    { 'TECH-02': 1.0, 'STAT-01': 0.5, 'STAT-03': 0.4 },
    'Using R and the survey package to declare stratified multistage designs, compute design correct estimates and standard errors, apply calibration and replicate weights, and produce publication ready output.'),
  C('KM-2091', 'SQL and Relational Data Management for Statisticians', 'NIC', 20, 2, 4.5, 12870, 'EN / HI',
    { 'TECH-03': 1.0, 'TECH-04': 0.2 },
    'Relational schema design, SELECT queries, joins, aggregation, window functions and indexing for statistical data warehouses. Loading unit level survey data and building query layers for dissemination systems.'),
  C('KM-2118', 'Big Data Platforms for Official Statistics', 'NIC', 24, 4, 4.0, 1340, 'EN',
    { 'TECH-04': 1.0, 'TECH-03': 0.4, 'TECH-01': 0.3 },
    'Distributed processing with Apache Spark for administrative and scanner data at scale. Cluster concepts, partitioning, data lake ingestion and cost aware pipeline design for statistical production environments.'),
  C('KM-2145', 'Machine Learning Applications in Official Statistics', 'ISI Kolkata', 32, 4, 4.2, 2760, 'EN',
    { 'TECH-05': 1.0, 'DIGI-06': 0.5, 'TECH-01': 0.4 },
    'Supervised classification for automatic coding of occupation and industry descriptions, model evaluation, class imbalance, and the use of prediction for editing and imputation without compromising statistical validity.'),
  C('KM-2172', 'Geospatial Analysis and GIS for Survey Operations', 'NIC', 20, 3, 4.3, 3420, 'EN / HI',
    { 'TECH-06': 1.0, 'STAT-02': 0.4 },
    'Digital block maps, shapefiles, coordinate systems and spatial joins for sampling frame maintenance. Geo tagging of enumeration blocks, route planning for field investigators and thematic mapping of indicators.'),
  C('KM-2199', 'Data Visualisation and Dashboard Design', 'iGOT Karmayogi', 16, 2, 4.6, 15680, 'EN / HI',
    { 'TECH-07': 1.0, 'BEHV-06': 0.5 },
    'Choosing chart forms that match the statistical message, designing dashboards for senior decision makers, accessibility and colour, annotation of uncertainty and avoiding misleading axis and scale choices.'),
  C('KM-2224', 'Building Statistical Dashboards with Open Tools', 'MoSPI', 18, 3, 4.1, 2050, 'EN',
    { 'TECH-07': 0.9, 'TECH-01': 0.5, 'DIGI-04': 0.4 },
    'Hands on construction of interactive indicator dashboards from published datasets, connecting to APIs, caching, refresh scheduling and publishing dashboards on government cloud infrastructure.'),

  C('KM-3011', 'e-Office and Digital File Management', 'iGOT Karmayogi', 8, 1, 4.4, 42100, 'EN / HI',
    { 'DIGI-01': 1.0 },
    'Electronic file creation, noting and drafting, digital signature certificates, movement and parking of files, and migration of physical records into the e-Office platform across government offices.'),
  C('KM-3038', 'Digital Personal Data Protection Act 2023: Duties of Data Fiduciaries', 'iGOT Karmayogi', 12, 2, 4.5, 27400, 'EN / HI',
    { 'DIGI-02': 1.0, 'BEHV-04': 0.4 },
    'Obligations of a data fiduciary under the Digital Personal Data Protection Act, lawful purpose and consent, notice requirements, rights of the data principal, breach notification and the exemption available for research and statistical purposes.'),
  C('KM-3055', 'Statistical Disclosure Control and Microdata Release', 'NSSTA', 16, 4, 4.4, 1420, 'EN',
    { 'DIGI-02': 0.9, 'STAT-07': 0.5, 'BEHV-04': 0.4 },
    'Protecting respondent confidentiality when releasing unit level records. Re identification risk, k anonymity, record swapping, top coding, perturbation and the statutory confidentiality guarantee under the Collection of Statistics Act.'),
  C('KM-3082', 'Cybersecurity Hygiene for Government Officials', 'CERT-In', 6, 1, 4.3, 51200, 'EN / HI',
    { 'DIGI-03': 1.0 },
    'Password practice and multi factor authentication, recognising phishing and social engineering, safe handling of removable media, incident reporting to the computer emergency response team and secure remote working.'),
  C('KM-3109', 'Open Data, APIs and Publishing on NDAP', 'MoSPI', 14, 3, 4.4, 3860, 'EN',
    { 'DIGI-04': 1.0, 'TECH-03': 0.3, 'BEHV-05': 0.3 , 'STAT-12': 0.5 },
    'Preparing machine readable datasets, writing metadata to the national standard, versioning, licensing, designing REST endpoints and publishing indicator series to the National Data and Analytics Platform.'),
  C('KM-3136', 'Cloud Fundamentals on MeghRaj for Data Teams', 'NIC', 12, 2, 4.1, 5240, 'EN',
    { 'DIGI-05': 1.0, 'TECH-04': 0.3 },
    'Government cloud service models, provisioning virtual machines and storage on MeghRaj, network security groups, backup policy and empanelled service provider compliance for statistical applications.'),
  C('KM-3163', 'Responsible AI in Public Administration', 'iGOT Karmayogi', 10, 2, 4.5, 18900, 'EN / HI',
    { 'DIGI-06': 1.0, 'BEHV-04': 0.5 },
    'Fairness, transparency and accountability when algorithms inform public decisions. Sources of bias in training data, explainability expectations, human oversight, and documenting model limitations for citizens.'),
  C('KM-3190', 'AI Assisted Assessment and Content Generation', 'NSSTA', 12, 3, 4.2, 1680, 'EN',
    { 'DIGI-06': 0.7, 'TECH-05': 0.5, 'BEHV-05': 0.4 },
    'Using large language models to draft training material and generate assessment items, prompt design, factual verification of generated questions and human in the loop review before deployment to learners.'),

  C('KM-4014', 'Leading Field Teams in Survey Operations', 'NSSTA', 14, 3, 4.5, 4980, 'EN / HI',
    { 'BEHV-01': 1.0, 'BEHV-03': 0.4, 'STAT-02': 0.3 },
    'Supervising field investigators across districts, allocation of workload, motivation and retention, quality supervision visits, resolving respondent escalations and conducting scrutiny of filled schedules.'),
  C('KM-4041', 'Inter-Ministerial Coordination and Committee Work', 'IIPA', 12, 3, 4.2, 3110, 'EN',
    { 'BEHV-02': 1.0, 'BEHV-05': 0.3 },
    'Working across ministries and state directorates, preparing agenda and background notes, negotiating data sharing arrangements, chairing technical committees and following up on decisions.'),
  C('KM-4068', 'Project Management for Survey Rounds', 'IIPA', 20, 3, 4.4, 5320, 'EN / HI',
    { 'BEHV-03': 1.0, 'BEHV-01': 0.4 },
    'Planning a survey round end to end: work breakdown, critical path, budget estimation, procurement of field resources, risk registers and monitoring progress against the release calendar.'),
  C('KM-4095', 'Fundamental Principles of Official Statistics', 'NSSTA', 8, 1, 4.8, 22600, 'EN / HI',
    { 'BEHV-04': 1.0, 'DIGI-02': 0.3 },
    'The United Nations Fundamental Principles of Official Statistics, professional independence, impartiality in release, equal access to published data, confidentiality of individual records and the duty to comment on misinterpretation.'),
  C('KM-4122', 'Technical Report Writing for Statistical Publications', 'NSSTA', 16, 3, 4.3, 4470, 'EN',
    { 'BEHV-05': 1.0, 'STAT-07': 0.3, 'BEHV-06': 0.3 },
    'Structuring a survey report, writing the methodology chapter, presenting estimates with measures of precision, drafting concept and definition annexures and maintaining consistency of terminology across releases.'),
  C('KM-4149', 'Data Storytelling for Policy Audiences', 'iGOT Karmayogi', 10, 2, 4.6, 9840, 'EN / HI',
    { 'BEHV-06': 1.0, 'TECH-07': 0.5 },
    'Translating statistical findings into narratives that senior policy makers and the public can act on, structuring a briefing, anticipating questions and communicating uncertainty without losing clarity.'),
  C('KM-4176', 'Public Speaking and Media Briefing for Officials', 'IIPA', 8, 2, 4.1, 6720, 'EN / HI',
    { 'BEHV-06': 0.9, 'BEHV-02': 0.4 },
    'Preparing and delivering briefings to press and stakeholders, handling difficult questions on data revisions, correcting misinterpretation of official figures and maintaining institutional voice.'),
  C('KM-4203', 'Ethics and Integrity in Public Service', 'iGOT Karmayogi', 6, 1, 4.5, 38400, 'EN / HI',
    { 'BEHV-04': 0.9, 'BEHV-02': 0.2 },
    'Conduct rules, conflict of interest, integrity in procurement and recruitment, whistle blower protection and the ethical obligations attached to holding sensitive citizen information.'),

  C('KM-5017', 'Induction Training for Statistical Officers', 'NSSTA', 30, 1, 4.4, 7900, 'EN / HI',
    { 'STAT-01': 0.4, 'STAT-02': 0.6, 'STAT-07': 0.4, 'BEHV-04': 0.5, 'DIGI-01': 0.4 },
    'Foundation programme covering the structure of the Indian Statistical System, principal surveys and their periodicity, field procedures, office workflow and the code of conduct expected of a statistical officer.'),
  C('KM-5044', 'Refresher on NSS Survey Instruments and Concepts', 'NSSTA', 12, 2, 4.3, 5140, 'EN / HI',
    { 'STAT-02': 0.8, 'STAT-01': 0.5, 'STAT-07': 0.4 },
    'Updated concepts and definitions across current National Sample Survey schedules, changes in classification, common field errors identified in scrutiny and clarifications issued since the previous round.'),
  C('KM-5071', 'Economic Census Operations and Listing Procedure', 'MoSPI', 16, 2, 4.2, 2870, 'EN / HI',
    { 'STAT-02': 0.8, 'BEHV-03': 0.4, 'TECH-06': 0.3 , 'STAT-10': 0.5 },
    'House listing and establishment identification for the Economic Census, treatment of own account enterprises, coverage rules and use of mobile applications for capture and geo tagging during listing.'),
  C('KM-5098', 'Administrative Data Sources for Statistical Production', 'NSSTA', 14, 4, 4.2, 1290, 'EN',
    { 'STAT-07': 0.7, 'TECH-03': 0.5, 'DIGI-02': 0.4, 'DIGI-04': 0.3 },
    'Assessing administrative registers for statistical use, record linkage and matching quality, coverage and definitional differences, and building a register based statistical system alongside sample surveys.'),
  C('KM-5125', 'Sustainable Development Goals: National Indicator Framework', 'MoSPI', 12, 2, 4.3, 6180, 'EN / HI',
    { 'STAT-05': 0.4, 'DIGI-04': 0.5, 'BEHV-05': 0.4, 'BEHV-02': 0.4 , 'STAT-11': 1.0 },
    'Structure of the National Indicator Framework, data sources and computation methodology for SDG indicators, periodicity, disaggregation requirements and reporting through the SDG India dashboard.'),
  C('KM-5152', 'Gender Statistics and Disaggregated Reporting', 'NSSTA', 10, 2, 4.4, 3320, 'EN / HI',
    { 'STAT-02': 0.4, 'BEHV-05': 0.4, 'BEHV-06': 0.4, 'DIGI-04': 0.3 , 'STAT-08': 0.4 },
    'Measuring unpaid work and time use, gender sensitive question design, disaggregation standards and interpreting differentials in labour force participation and asset ownership.'),
  C('KM-5179', 'Periodic Labour Force Survey: Methods and Estimates', 'MoSPI', 18, 3, 4.5, 4610, 'EN',
    { 'STAT-01': 0.6, 'STAT-02': 0.6, 'STAT-03': 0.4, 'STAT-07': 0.3 , 'STAT-08': 1.0 },
    'Rotational panel design of the Periodic Labour Force Survey, current weekly and usual status approaches, activity classification, estimation of unemployment rate and worker population ratio.'),
  C('KM-5206', 'Annual Survey of Industries: Frame and Processing', 'MoSPI', 16, 3, 4.1, 1760, 'EN',
    { 'STAT-01': 0.5, 'STAT-07': 0.6, 'STAT-05': 0.5, 'TECH-03': 0.3 , 'STAT-10': 0.9 },
    'Maintenance of the ASI frame from the Business Register, census and sample sectors, return processing, editing of factory returns and computation of principal characteristics of the factory sector.'),
  C('KM-5233', 'Agricultural Statistics: Crop Area and Yield Estimation', 'NSSTA', 18, 3, 4.2, 2140, 'EN / HI',
    { 'STAT-09': 1.0, 'STAT-01': 0.4, 'TECH-06': 0.3 },
    'General Crop Estimation Surveys, crop cutting experiments and the timely reporting scheme for area enumeration. Covers land use classification, yield estimation for principal crops and the use of remote sensing to supplement field observation.'),
  C('KM-5260', 'Metadata Standards and Statistical Documentation', 'MoSPI', 12, 3, 4.1, 1520, 'EN',
    { 'STAT-12': 1.0, 'DIGI-04': 0.5, 'BEHV-05': 0.4 },
    'Documenting a statistical product so others can use it correctly. Concepts and definitions, classification versions, provenance and lineage, data dictionaries and the SDMX and DDI exchange standards used for indicator reporting.'),
  C('KM-3217', 'Digital Public Infrastructure for Data Exchange', 'NIC', 14, 3, 4.3, 6240, 'EN / HI',
    { 'DIGI-07': 1.0, 'DIGI-05': 0.4, 'DIGI-02': 0.3 },
    'Population scale digital rails and what they mean for statistical work: Aadhaar authentication, unified payments, DigiLocker, consent managers and interoperable registries, and the governance conditions for using them as data sources.'),
  C('KM-4230', 'Leading Change in Public Organisations', 'IIPA', 14, 3, 4.2, 4180, 'EN / HI',
    { 'BEHV-08': 1.0, 'BEHV-01': 0.4, 'BEHV-02': 0.3 },
    'Carrying colleagues through a change in method or technology. Diagnosing resistance, sequencing a reform, communicating what stays the same, and sustaining a new practice after the rollout team has moved on.'),
  C('KM-4257', 'Evidence-Based Decision Making for Administrators', 'IIPA', 12, 3, 4.4, 5310, 'EN / HI',
    { 'BEHV-07': 1.0, 'BEHV-06': 0.4, 'STAT-03': 0.3 },
    'Framing a decision question so evidence can answer it, weighing the quality of competing sources, reasoning under uncertainty, recognising common cognitive biases and judging when the cost of further delay exceeds the value of more data.'),
  C('KM-2251', 'Applied AI and Emerging Technology for Statistical Offices', 'NSSTA', 20, 4, 4.3, 3120, 'EN',
    { 'TECH-05': 0.7, 'DIGI-06': 0.6, 'TECH-04': 0.4, 'TECH-01': 0.3 },
    'Where artificial intelligence genuinely helps a statistical office: automatic coding of open responses, assisted editing and imputation, nowcasting from high frequency sources, and document processing. Includes hands on virtual laboratory exercises.')
];
/* The curated set above is the NSSTA TPAC supplement: programmes the
   problem statement asks us to recommend alongside iGOT, whose metadata
   is not published as an API. Their competency mapping is hand-authored
   and doubles as the reference set for validating the automatic mapper. */
NX.TPAC_COURSES.forEach(function (c) {
  c.origin = 'tpac'; c.tpac = true; c.covRef = c.cov;
  c.secs = c.hours * 3600;
});

/* The iGOT catalogue is the real platform export, normalised by
   tools/ingest-igot.mjs. It carries no competency tags — the engine
   derives them at runtime, so the mapping can be inspected. */
NX.IGOT_COURSES = (NX.IGOT_RAW || []).map(function (r) {
  return {
    id: r[0], title: r[1], provider: r[2], secs: r[3],
    hours: Math.max(1, Math.round(r[3] / 3600)),
    lang: r[4], level: r[5], text: r[6],
    cov: {}, origin: 'igot', real: true
  };
});

NX.COURSES = NX.IGOT_COURSES.concat(NX.TPAC_COURSES);
NX.courseById = {};
NX.COURSES.forEach(function (c) { NX.courseById[c.id] = c; });

/* ---------- 5. Featured officer profiles ----------
   `bias` shifts realised proficiency per domain relative to the
   role target so each demo persona has a distinct gap signature. */
NX.OFFICERS = [
  { id: 'OFF-001', name: 'Ananya Iyer', gender: 'F', role: 'ISS-DD', seed: 4117,
    posting: 'Economic Statistics Division, MoSPI', station: 'New Delhi',
    exp: 9, batch: 'ISS 2016', qual: ['M.Sc. Statistics'],
    bias: { STAT: 0.14, TECH: -0.34, DIGI: -0.22, BEHV: 0.04 },
    trainings: [
      { c: 'KM-5017', on: '2016-08', score: 78 },
      { c: 'KM-1210', on: '2021-02', score: 84 },
      { c: 'KM-3011', on: '2023-06', score: 91 },
      { c: 'KM-4122', on: '2022-11', score: 72 }
    ],
    note: 'Leads the quarterly GVA compilation cell. Flagged by her Director as ready for a data-engineering stretch assignment.' },

  { id: 'OFF-002', name: 'Rakesh Meena', gender: 'M', role: 'SSS-JSO', seed: 9042,
    posting: 'NSSO Field Operations Division, Regional Office', station: 'Jaipur',
    exp: 4, batch: 'SSS 2021', qual: ['B.Sc. Mathematics'],
    bias: { STAT: -0.10, TECH: -0.30, DIGI: -0.18, BEHV: 0.02 },
    trainings: [
      { c: 'KM-5017', on: '2021-11', score: 69 },
      { c: 'KM-3082', on: '2024-01', score: 74 }
    ],
    note: 'Handles PLFS and CES schedules across four districts. Due for the next scrutiny-supervisor selection cycle.' },

  { id: 'OFF-003', name: 'Priya Nambiar', gender: 'F', role: 'MOSPI-DA', seed: 2288,
    posting: 'Data Informatics & Innovation Division (NDAP)', station: 'New Delhi',
    exp: 3, batch: 'Lateral 2022', qual: ['M.Tech. Data Science'],
    bias: { STAT: -0.30, TECH: 0.16, DIGI: 0.04, BEHV: -0.16 },
    trainings: [
      { c: 'KM-2010', on: '2023-03', score: 93 },
      { c: 'KM-2091', on: '2023-09', score: 88 },
      { c: 'KM-3163', on: '2024-07', score: 81 }
    ],
    note: 'Strong engineering base, thin on survey methodology — the classic lateral-entry gap signature.' },

  { id: 'OFF-004', name: 'Suresh Chandra Behera', gender: 'M', role: 'ISS-DIR', seed: 6631,
    posting: 'Social Statistics Division, MoSPI', station: 'New Delhi',
    exp: 21, batch: 'ISS 2004', qual: ['M.Phil. Economics'],
    bias: { STAT: 0.06, TECH: -0.44, DIGI: -0.32, BEHV: 0.12 },
    trainings: [
      { c: 'KM-5017', on: '2004-09', score: 74 },
      { c: 'KM-1210', on: '2011-05', score: 80 },
      { c: 'KM-4068', on: '2016-08', score: 86 },
      { c: 'KM-4041', on: '2019-03', score: 83 },
      { c: 'KM-5125', on: '2022-01', score: 79 }
    ],
    note: 'Chairs the SDG indicator working group. Digital-governance competencies have not been refreshed since 2019.' },

  { id: 'OFF-005', name: 'Kavitha Rangan', gender: 'F', role: 'DES-SO', seed: 5519,
    posting: 'Directorate of Economics & Statistics, Government of Tamil Nadu', station: 'Chennai',
    exp: 11, batch: 'State 2014', qual: ['M.A. Economics'],
    bias: { STAT: 0.00, TECH: -0.26, DIGI: -0.10, BEHV: -0.06 },
    trainings: [
      { c: 'KM-1150', on: '2018-07', score: 82 },
      { c: 'KM-5071', on: '2020-02', score: 77 },
      { c: 'KM-3011', on: '2023-10', score: 85 }
    ],
    note: 'State-level CPI and district domestic product work. Nominated by the State DES for the TPAC advanced pool.' },

  { id: 'OFF-006', name: 'Imran Qureshi', gender: 'M', role: 'NSSO-FI', seed: 7743,
    posting: 'NSSO Field Operations Division, Sub-Regional Office', station: 'Lucknow',
    exp: 6, batch: 'SSS 2019', qual: ['B.A. Economics'],
    bias: { STAT: 0.04, TECH: -0.22, DIGI: -0.14, BEHV: -0.02 },
    trainings: [
      { c: 'KM-5017', on: '2019-10', score: 71 },
      { c: 'KM-5044', on: '2023-04', score: 80 },
      { c: 'KM-1103', on: '2024-02', score: 76 }
    ],
    note: 'Highest schedule-completion rate in the sub-region. Weak on the tablet-based capture workflow introduced in 2024.' }
];

/* ---------- 6. Synthetic workforce for admin analytics ---------- */
NX.STATIONS = ['New Delhi', 'Kolkata', 'Mumbai', 'Chennai', 'Bengaluru', 'Hyderabad',
  'Lucknow', 'Jaipur', 'Guwahati', 'Bhopal', 'Ahmedabad', 'Patna'];

NX.buildWorkforce = function (n) {
  var rnd = NX.rng(20260101), out = [], roles = NX.ROLES, i;
  var mix = ['SSS-JSO', 'SSS-JSO', 'SSS-JSO', 'NSSO-FI', 'NSSO-FI', 'NSSO-FI',
    'SSS-SSO', 'SSS-SSO', 'DES-SO', 'DES-SO', 'ISS-DD', 'ISS-DIR', 'MOSPI-DA', 'NSSTA-FAC'];
  for (i = 0; i < n; i++) {
    var roleId = mix[Math.floor(rnd() * mix.length)];
    var exp = 1 + Math.floor(rnd() * 28);
    out.push({
      id: 'W' + (1000 + i), role: roleId, exp: exp,
      station: NX.STATIONS[Math.floor(rnd() * NX.STATIONS.length)],
      seed: Math.floor(rnd() * 1e6),
      bias: {
        STAT: (rnd() - 0.42) * 0.5,
        TECH: (rnd() - 0.74) * 0.62,
        DIGI: (rnd() - 0.66) * 0.55,
        BEHV: (rnd() - 0.48) * 0.46
      },
      trainings: [], qual: [], synthetic: true
    });
  }
  return out;
};

/* ---------- 7. Sample learning material for the MCQ engine ---------- */
NX.MATERIALS = [
  {
    id: 'MAT-01',
    title: 'Sampling Design in National Sample Surveys',
    src: 'NSSTA Reading Note · Module 3',
    kind: 'PDF · 14 pages',
    comp: ['STAT-01', 'STAT-02'],
    text:
      'The National Sample Survey uses a stratified multistage sampling design. In rural areas the first stage unit is the village as defined in the Population Census, while in urban areas the first stage unit is the Urban Frame Survey block. The ultimate stage unit is the household in household surveys and the enterprise in enterprise surveys.\n\n' +
      'Stratification is the division of the survey population into homogeneous groups called strata before selection. Each district normally forms a separate stratum, and within a district the rural and urban sectors are treated as separate sub strata. Stratification reduces the sampling variance of the estimator because variation within a stratum is smaller than variation across the whole population.\n\n' +
      'First stage units are selected with probability proportional to size using the population recorded in the latest Census as the size measure. This method gives larger villages a higher chance of selection, which improves efficiency when the study variable is correlated with the size of the unit. Selection is carried out with replacement in most rounds so that variance estimation remains straightforward.\n\n' +
      'Within each selected first stage unit the households are arranged in a second stage stratum on the basis of a listing operation carried out by the field investigator. In the Consumption Expenditure Survey the second stage stratification uses the value of land possessed in rural areas and the monthly per capita expenditure indicator in urban areas. A fixed number of households, usually eight, is then selected by systematic random sampling from each second stage stratum.\n\n' +
      'The design weight attached to a sampled household is the reciprocal of its probability of selection. The multiplier is the product of the first stage and second stage inverse selection probabilities adjusted for non response. Estimates of population totals are obtained by summing the weighted values of the study variable over all responding sample units.\n\n' +
      'The sample is drawn in the form of two independent sub samples of equal size. This sub sample structure allows a simple estimate of sampling variance to be computed as the squared difference between the two sub sample estimates. It also permits the release of provisional results from a single sub sample when timeliness is critical.\n\n' +
      'Non sampling error arises from sources other than the act of sampling, including incorrect recording, respondent recall failure, non response and processing mistakes. Unlike sampling error, non sampling error does not reduce as the sample size increases, and in a large sample it may dominate the total error. Control of non sampling error therefore depends on training, supervision and scrutiny rather than on enlarging the sample.\n\n' +
      'The relative standard error is the standard error of an estimate expressed as a percentage of the estimate itself. As a working rule, an estimate with a relative standard error above 20 per cent is regarded as unreliable for separate publication and is either suppressed or released with a cautionary footnote.'
  },
  {
    id: 'MAT-02',
    title: 'Compilation of the Consumer Price Index',
    src: 'MoSPI Technical Manual · Chapter 2',
    kind: 'PPTX · 32 slides',
    comp: ['STAT-04', 'STAT-06'],
    text:
      'The Consumer Price Index measures the change over time in the general level of prices of a fixed basket of goods and services consumed by households. The Central Statistics Office compiles and releases the all India Consumer Price Index every month, with the current base year of 2012 equal to 100.\n\n' +
      'The index is computed using the Laspeyres formula, which holds the quantity weights fixed at the base period. This means the index measures the cost of purchasing the base period basket at current prices relative to the cost of purchasing the same basket at base period prices. The Laspeyres form is preferred in official practice because it requires price data only for the current period once the weights have been fixed.\n\n' +
      'Weights are derived from the household Consumption Expenditure Survey. The weight of an item is the share of total consumption expenditure that households devote to that item in the base year. Separate weighting diagrams are prepared for the rural and urban sectors because consumption patterns differ substantially between them.\n\n' +
      'The item basket for the current series contains 299 items in the rural sector and 299 items in the urban sector. Prices are collected from 1181 selected villages and 1114 selected urban markets spread across the country. Rural prices are collected by the field staff of the National Statistical Office while urban price collection is carried out through the National Sample Survey Office and the Department of Posts.\n\n' +
      'Price quotations are collected on a fixed day of the week according to a market schedule, and each price relative is computed as the ratio of the current price to the base price of the same specification. Item level indices are aggregated to sub group, group and general index level using the weighted geometric mean of price relatives at the elementary level and the weighted arithmetic mean above it.\n\n' +
      'Quality adjustment is required when the specification of an item changes. If a directly comparable replacement is unavailable, the price movement is imputed from other items in the same elementary aggregate so that a genuine quality improvement is not recorded as a price increase.\n\n' +
      'The inflation rate is the percentage change in the index over the corresponding month of the previous year. Core inflation excludes the food and fuel groups because these are volatile and are frequently affected by supply shocks rather than by underlying demand conditions.\n\n' +
      'Base year revision is undertaken periodically to keep the weighting diagram representative of current consumption patterns. When the base is revised, the new series is linked to the old series using a linking factor computed for the overlap period, so that a continuous long run series remains available to users.'
  },
  {
    id: 'MAT-03',
    title: 'Data Privacy Obligations under the DPDP Act 2023',
    src: 'iGOT Karmayogi Course Handout',
    kind: 'PDF · 9 pages',
    comp: ['DIGI-02', 'BEHV-04'],
    text:
      'The Digital Personal Data Protection Act 2023 governs the processing of digital personal data in India. Personal data means any data about an individual who is identifiable by or in relation to such data. The individual to whom the personal data relates is called the Data Principal.\n\n' +
      'A Data Fiduciary is any person who alone or in conjunction with others determines the purpose and means of processing personal data. Government departments that collect citizen information in the course of statistical work act as Data Fiduciaries and carry the full set of obligations under the Act.\n\n' +
      'Personal data may be processed only for a lawful purpose for which the Data Principal has given consent, or for certain legitimate uses specified in the Act. Consent must be free, specific, informed, unconditional and unambiguous, and it must be given through a clear affirmative action. Every request for consent must be accompanied by a notice stating the personal data to be collected and the purpose of processing.\n\n' +
      'The Data Principal has the right to obtain information about processing, the right to correction and erasure, the right to grievance redressal and the right to nominate another individual to exercise these rights in the event of death or incapacity. A Data Fiduciary must respond to a grievance within the period prescribed by the rules.\n\n' +
      'The Act requires a Data Fiduciary to implement reasonable security safeguards to prevent a personal data breach. In the event of a breach, the Data Fiduciary must give notice to the Data Protection Board of India and to each affected Data Principal. Failure to take reasonable security safeguards attracts a penalty of up to two hundred and fifty crore rupees.\n\n' +
      'Processing of personal data for research, archiving or statistical purposes is exempt from most obligations of the Act provided the personal data is not used to take any decision specific to a particular Data Principal and the processing is carried out in accordance with prescribed standards. Statistical agencies must therefore ensure that outputs are aggregate in nature.\n\n' +
      'Purpose limitation requires that personal data collected for one stated purpose is not repurposed without fresh consent. Data minimisation requires that only the personal data necessary for the specified purpose is collected. Storage limitation requires erasure once the specified purpose is no longer being served, unless retention is required by law.\n\n' +
      'The Collection of Statistics Act 2008 separately guarantees that individual information collected under it shall be used only for statistical purposes and shall not be disclosed in any manner that identifies a particular informant. This statutory confidentiality guarantee operates alongside the obligations of the Digital Personal Data Protection Act.'
  },
  {
    id: 'MAT-04',
    title: 'Data Quality Assurance, Editing and Imputation',
    src: 'NSSTA Faculty Deck · Session 7',
    kind: 'Video transcript · 48 min',
    comp: ['STAT-07', 'TECH-01'],
    text:
      'Data editing is the process of detecting and correcting errors in collected data before estimates are produced. Editing has three purposes: to identify sources of error in the survey process, to provide information for future improvement of the instrument, and to ensure that the published estimates are internally consistent.\n\n' +
      'A validation rule expresses a condition that a correct record must satisfy. Range rules check that a value lies within plausible limits, consistency rules check relationships between fields such as the requirement that total expenditure equals the sum of its components, and historical rules compare a record with the value reported by the same unit in a previous period.\n\n' +
      'Selective editing concentrates manual review on the records whose correction would materially change the published aggregate. Each record is given a score that combines the size of the suspected error with the sampling weight of the unit, and only records above a threshold are referred to a subject matter expert. Selective editing typically reduces manual editing effort by more than half without measurable loss of accuracy.\n\n' +
      'The Fellegi Holt principle states that the data in each record should be made to satisfy all edit rules by changing the fewest possible number of fields. Automatic edit and imputation systems implement this principle by solving an error localisation problem for each failing record.\n\n' +
      'Imputation is the substitution of an acceptable value for a missing or rejected value. Deductive imputation derives the value logically from other fields in the same record. Hot deck imputation copies the value from a similar responding record called the donor. Model based imputation predicts the value from a regression or other statistical model fitted to the responding units.\n\n' +
      'Every imputed value must be flagged so that users can identify which figures are reported and which are derived. The imputation rate is the proportion of values in a variable that were imputed, and it is published as a quality indicator alongside the estimates.\n\n' +
      'Over editing occurs when resources are spent correcting errors that have no material effect on the estimates. It inflates cost, delays release and can introduce bias if editors systematically adjust values towards their own expectations. The remedy is to measure the impact of each edit rule on the final aggregate and to retire rules that change little.\n\n' +
      'The quality of official statistics is assessed against several dimensions: relevance to user needs, accuracy, timeliness and punctuality of release, accessibility and clarity of presentation, and coherence and comparability across time and across sources. A quality report documenting these dimensions accompanies each major release.'
  }
];
