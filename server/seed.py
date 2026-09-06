"""
Seed Neon from the same files the frontend uses.

    python seed.py                # uses DATABASE_URL from the environment
    python seed.py --reset        # truncate first, then load

Reads:
    ../data/courses.json     the iGOT Karmayogi platform export
    seed_data.json           framework, roles, officers, TPAC supplement
                             (regenerate with: node tools/export-seed.mjs)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

import asyncpg

HERE = Path(__file__).parent
ROOT = HERE.parent

LOW = re.compile(
    r"\b(introduc\w*|basics?|fundamental\w*|awareness|beginner|overview|primer|orientation|induction|part 1|module 1)\b",
    re.I,
)
MID = re.compile(
    r"\b(applied|practitioner|professional|certification|hands.?on|workshop|practical|implementation|for officials)\b",
    re.I,
)
HIGH = re.compile(
    r"\b(advanced|expert|mastering|master ?class|in-depth|deep dive|specialis\w*|specializ\w*|strategic|leadership programme)\b",
    re.I,
)
TAGS = re.compile(r"<[^>]*>")
ENTS = {"&nbsp;": " ", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">"}
DEVANAGARI = re.compile(r"[ऀ-ॿ]")


def clean(s: str | None) -> str:
    s = TAGS.sub(" ", str(s or ""))
    for k, v in ENTS.items():
        s = s.replace(k, v)
    return re.sub(r"\s+", " ", s).strip()


def level_of(hours: int, text: str) -> int:
    lv = 2
    if LOW.search(text):
        lv = 1
    if MID.search(text):
        lv = 3
    if HIGH.search(text):
        lv = 4
    if hours >= 8:
        lv += 1
    if hours >= 25:
        lv += 1
    return max(1, min(5, lv))


def load_igot() -> list[dict]:
    """Mirrors tools/ingest-igot.mjs so both paths produce the same rows."""
    path = ROOT / "data" / "courses.json"
    if not path.exists():
        print(f"!  {path} not found — skipping the iGOT catalogue", file=sys.stderr)
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    seen: dict[str, dict] = {}
    for r in raw.get("content", []):
        if r.get("primaryCategory") != "Course":
            continue
        title, text = clean(r.get("name")), clean(r.get("description"))
        if not title or re.search(r"- C\d{5,}$", title):
            continue
        if re.match(r"^Course - .* summary$", text, re.I):
            continue
        secs = int(float(r.get("duration") or 0))
        hours = max(1, round(secs / 3600))
        blob = f"{title} {text}"
        rec = {
            "id": str(r.get("identifier") or "").strip(),
            "title": title,
            "provider": clean(r.get("source")) or "iGOT Karmayogi",
            "secs": secs,
            "lang": "HI" if DEVANAGARI.search(blob) else "EN",
            "level": level_of(hours, blob),
            "abstract": text,
            "origin": "igot",
            "cov": None,
        }
        key = title.lower()
        prev = seen.get(key)
        if prev and len(rec["abstract"]) <= len(prev["abstract"]):
            continue
        seen[key] = rec
    return list(seen.values())


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="truncate tables before loading")
    args = ap.parse_args()

    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("!  DATABASE_URL is not set.", file=sys.stderr)
        print("   PowerShell:  $env:DATABASE_URL = 'postgresql://...'", file=sys.stderr)
        return 1

    seed_path = HERE / "seed_data.json"
    if not seed_path.exists():
        print("!  seed_data.json missing — run: node tools/export-seed.mjs", file=sys.stderr)
        return 1
    seed = json.loads(seed_path.read_text(encoding="utf-8"))

    igot = load_igot()
    tpac = seed["tpacCourses"]
    print(f"   iGOT modules  {len(igot)}")
    print(f"   TPAC modules  {len(tpac)}")

    con = await asyncpg.connect(url, statement_cache_size=0)
    try:
        from main import SCHEMA  # single definition of the schema

        await con.execute(SCHEMA)

        if args.reset:
            await con.execute(
                "TRUNCATE assessments, trainings, officers, courses, roles, competencies CASCADE"
            )
            print("   truncated existing rows")

        await con.executemany(
            """INSERT INTO competencies (id, domain, name, crit, trend, kw)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT (id) DO UPDATE SET
                 domain=EXCLUDED.domain, name=EXCLUDED.name,
                 crit=EXCLUDED.crit, trend=EXCLUDED.trend, kw=EXCLUDED.kw""",
            [(c["id"], c["domain"], c["name"], c["crit"], c["trend"], c["kw"])
             for c in seed["competencies"]],
        )

        await con.executemany(
            """INSERT INTO roles (id, name, cadre, level, target)
               VALUES ($1,$2,$3,$4,$5::jsonb)
               ON CONFLICT (id) DO UPDATE SET
                 name=EXCLUDED.name, cadre=EXCLUDED.cadre,
                 level=EXCLUDED.level, target=EXCLUDED.target""",
            [(r["id"], r["name"], r["cadre"], r["level"], json.dumps(r["target"]))
             for r in seed["roles"]],
        )

        courses = igot + [
            {
                "id": c["id"], "title": c["title"], "provider": c["provider"],
                "secs": c["secs"], "lang": c["lang"], "level": c["level"],
                "abstract": c["abstract"], "origin": "tpac", "cov": c.get("cov"),
            }
            for c in tpac
        ]
        await con.executemany(
            """INSERT INTO courses (id, title, provider, secs, lang, level, abstract, origin, cov)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
               ON CONFLICT (id) DO UPDATE SET
                 title=EXCLUDED.title, provider=EXCLUDED.provider, secs=EXCLUDED.secs,
                 lang=EXCLUDED.lang, level=EXCLUDED.level, abstract=EXCLUDED.abstract,
                 origin=EXCLUDED.origin, cov=EXCLUDED.cov""",
            [(c["id"], c["title"], c["provider"], c["secs"], c["lang"], c["level"],
              c["abstract"], c["origin"],
              json.dumps(c["cov"]) if c.get("cov") else None) for c in courses],
        )

        await con.executemany(
            """INSERT INTO officers (id, name, role_id, posting, station, exp, batch, qual, bias, seed, note)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)
               ON CONFLICT (id) DO UPDATE SET
                 name=EXCLUDED.name, role_id=EXCLUDED.role_id, posting=EXCLUDED.posting,
                 station=EXCLUDED.station, exp=EXCLUDED.exp, batch=EXCLUDED.batch,
                 qual=EXCLUDED.qual, bias=EXCLUDED.bias, seed=EXCLUDED.seed, note=EXCLUDED.note""",
            [(o["id"], o["name"], o["role_id"], o["posting"], o["station"], o["exp"],
              o["batch"], json.dumps(o["qual"]), json.dumps(o["bias"]), o["seed"], o["note"])
             for o in seed["officers"]],
        )

        rows = [
            (o["id"], t["course_id"], t["completed_on"], t["score"])
            for o in seed["officers"] for t in o["trainings"]
        ]
        await con.executemany(
            """INSERT INTO trainings (officer_id, course_id, completed_on, score)
               VALUES ($1,$2,$3::date,$4)
               ON CONFLICT (officer_id, course_id) DO UPDATE SET score = EXCLUDED.score""",
            rows,
        )

        counts = {}
        for t in ("competencies", "roles", "courses", "officers", "trainings", "assessments"):
            counts[t] = await con.fetchval(f"SELECT count(*) FROM {t}")
        print("\n   seeded:")
        for k, v in counts.items():
            print(f"     {k:<14}{v}")
    finally:
        await con.close()
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(HERE))
    raise SystemExit(asyncio.run(main()))
