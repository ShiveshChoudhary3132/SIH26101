"""
SAMARTH · persistence and catalogue service
SIH26101 · Team SPARK

Deliberately narrow in scope. The competency engine, the recommender and the
assessment generator all run in the browser — that is what keeps uploaded
training material on the officer's own machine. This service does the one
thing a browser cannot: remember things between sessions, and serve the
catalogue from a database instead of a bundled file.

Endpoints
    GET  /health                              liveness + schema state
    GET  /api/catalogue                       course catalogue
    GET  /api/competencies                    framework + role target matrices
    GET  /api/officers                        officer roster
    GET  /api/officers/{id}                   one officer with service record
    POST /api/officers/{id}/completions       record a module completion
    POST /api/officers/{id}/assessments       record an assessment attempt
    GET  /api/analytics/summary               aggregates the database can honestly compute
"""
from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any

import asyncpg
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

HERE = Path(__file__).parent
DATABASE_URL = os.environ.get("DATABASE_URL", "")
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS competencies (
    id          text PRIMARY KEY,
    domain      text NOT NULL,
    name        text NOT NULL,
    crit        int  NOT NULL,
    trend       real NOT NULL DEFAULT 1.0,
    kw          text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS roles (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    cadre       text NOT NULL,
    level       text NOT NULL,
    target      jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
    id          text PRIMARY KEY,
    title       text NOT NULL,
    provider    text NOT NULL,
    secs        int  NOT NULL DEFAULT 3600,
    lang        text NOT NULL DEFAULT 'EN',
    level       int  NOT NULL DEFAULT 2,
    abstract    text NOT NULL DEFAULT '',
    origin      text NOT NULL DEFAULT 'igot',
    cov         jsonb
);
CREATE INDEX IF NOT EXISTS courses_origin_idx ON courses (origin);

CREATE TABLE IF NOT EXISTS officers (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    role_id     text NOT NULL REFERENCES roles (id),
    posting     text NOT NULL DEFAULT '',
    station     text NOT NULL DEFAULT '',
    exp         int  NOT NULL DEFAULT 0,
    batch       text NOT NULL DEFAULT '',
    qual        jsonb NOT NULL DEFAULT '[]'::jsonb,
    bias        jsonb NOT NULL DEFAULT '{}'::jsonb,
    seed        int  NOT NULL DEFAULT 1,
    note        text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS trainings (
    id            bigserial PRIMARY KEY,
    officer_id    text NOT NULL REFERENCES officers (id) ON DELETE CASCADE,
    course_id     text NOT NULL,
    completed_on  date NOT NULL DEFAULT CURRENT_DATE,
    score         int  NOT NULL DEFAULT 0,
    recorded_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (officer_id, course_id)
);
CREATE INDEX IF NOT EXISTS trainings_officer_idx ON trainings (officer_id);

CREATE TABLE IF NOT EXISTS assessments (
    id            bigserial PRIMARY KEY,
    officer_id    text NOT NULL REFERENCES officers (id) ON DELETE CASCADE,
    title         text NOT NULL,
    competencies  text[] NOT NULL DEFAULT '{}',
    pct           int  NOT NULL,
    weight        real NOT NULL DEFAULT 1.0,
    item_count    int  NOT NULL DEFAULT 0,
    taken_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessments_officer_idx ON assessments (officer_id);
"""


# --------------------------------------------------------------------------- app
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = None
    app.state.db_error = None
    if DATABASE_URL:
        try:
            app.state.pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=1,
                max_size=5,
                command_timeout=30,
                # Neon's pooled endpoint runs PgBouncer in transaction mode,
                # which cannot hold prepared statements between queries.
                statement_cache_size=0,
            )
            async with app.state.pool.acquire() as con:
                await con.execute(SCHEMA)
        except Exception as exc:  # keep serving /health so the failure is visible
            app.state.db_error = f"{type(exc).__name__}: {exc}"
    else:
        app.state.db_error = "DATABASE_URL is not set"
    yield
    if app.state.pool:
        await app.state.pool.close()


app = FastAPI(title="SAMARTH API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


async def db() -> asyncpg.Pool:
    if app.state.pool is None:
        raise HTTPException(
            status_code=503,
            detail=f"database unavailable — {app.state.db_error}",
        )
    return app.state.pool


def jsonable(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def row_to_dict(row: asyncpg.Record) -> dict:
    out = {}
    for k, v in dict(row).items():
        if isinstance(v, str) and k in ("qual", "bias", "target", "cov"):
            try:
                v = json.loads(v)
            except (TypeError, ValueError):
                pass
        out[k] = jsonable(v)
    return out


# --------------------------------------------------------------------------- models
class CompletionIn(BaseModel):
    course_id: str = Field(min_length=1, max_length=120)
    score: int = Field(default=82, ge=0, le=100)
    completed_on: date | None = None


class AssessmentIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    competencies: list[str] = Field(default_factory=list, max_length=12)
    pct: int = Field(ge=0, le=100)
    weight: float = Field(default=1.0, ge=0, le=5)
    item_count: int = Field(default=0, ge=0, le=200)


# --------------------------------------------------------------------------- routes
@app.get("/health")
async def health():
    ok = app.state.pool is not None
    counts = {}
    if ok:
        async with app.state.pool.acquire() as con:
            for table in ("courses", "competencies", "officers", "trainings", "assessments"):
                counts[table] = await con.fetchval(f"SELECT count(*) FROM {table}")
    return {
        "status": "ok" if ok else "degraded",
        "database": "connected" if ok else "unavailable",
        "detail": app.state.db_error,
        "rows": counts,
    }


@app.get("/api/catalogue")
async def catalogue(origin: str | None = None, limit: int = 2000):
    pool = await db()
    sql = "SELECT id, title, provider, secs, lang, level, abstract, origin, cov FROM courses"
    args: list = []
    if origin:
        sql += " WHERE origin = $1"
        args.append(origin)
    sql += f" ORDER BY origin, title LIMIT {max(1, min(limit, 5000))}"
    async with pool.acquire() as con:
        rows = await con.fetch(sql, *args)
    return {"count": len(rows), "courses": [row_to_dict(r) for r in rows]}


@app.get("/api/competencies")
async def competencies():
    pool = await db()
    async with pool.acquire() as con:
        comps = await con.fetch(
            "SELECT id, domain, name, crit, trend, kw FROM competencies ORDER BY id"
        )
        roles = await con.fetch("SELECT id, name, cadre, level, target FROM roles ORDER BY id")
    return {
        "competencies": [row_to_dict(r) for r in comps],
        "roles": [row_to_dict(r) for r in roles],
    }


@app.get("/api/officers")
async def officers():
    pool = await db()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """
            SELECT o.*,
                   (SELECT count(*) FROM trainings   t WHERE t.officer_id = o.id) AS training_count,
                   (SELECT count(*) FROM assessments a WHERE a.officer_id = o.id) AS assessment_count
            FROM officers o ORDER BY o.id
            """
        )
    return {"officers": [row_to_dict(r) for r in rows]}


@app.get("/api/officers/{officer_id}")
async def officer(officer_id: str):
    pool = await db()
    async with pool.acquire() as con:
        row = await con.fetchrow("SELECT * FROM officers WHERE id = $1", officer_id)
        if row is None:
            raise HTTPException(status_code=404, detail="officer not found")
        trainings = await con.fetch(
            """SELECT course_id, completed_on, score FROM trainings
               WHERE officer_id = $1 ORDER BY completed_on""",
            officer_id,
        )
        assessments = await con.fetch(
            """SELECT title, competencies, pct, weight, item_count, taken_at
               FROM assessments WHERE officer_id = $1 ORDER BY taken_at""",
            officer_id,
        )
    out = row_to_dict(row)
    out["trainings"] = [row_to_dict(r) for r in trainings]
    out["assessments"] = [row_to_dict(r) for r in assessments]
    return out


@app.post("/api/officers/{officer_id}/completions", status_code=201)
async def add_completion(officer_id: str, body: CompletionIn):
    pool = await db()
    async with pool.acquire() as con:
        exists = await con.fetchval("SELECT 1 FROM officers WHERE id = $1", officer_id)
        if not exists:
            raise HTTPException(status_code=404, detail="officer not found")
        await con.execute(
            """
            INSERT INTO trainings (officer_id, course_id, completed_on, score)
            VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4)
            ON CONFLICT (officer_id, course_id)
            DO UPDATE SET score = EXCLUDED.score, completed_on = EXCLUDED.completed_on
            """,
            officer_id, body.course_id, body.completed_on, body.score,
        )
        total = await con.fetchval(
            "SELECT count(*) FROM trainings WHERE officer_id = $1", officer_id
        )
    return {"recorded": True, "officer_id": officer_id, "total_completions": total}


@app.post("/api/officers/{officer_id}/assessments", status_code=201)
async def add_assessment(officer_id: str, body: AssessmentIn):
    pool = await db()
    async with pool.acquire() as con:
        exists = await con.fetchval("SELECT 1 FROM officers WHERE id = $1", officer_id)
        if not exists:
            raise HTTPException(status_code=404, detail="officer not found")
        new_id = await con.fetchval(
            """
            INSERT INTO assessments (officer_id, title, competencies, pct, weight, item_count)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
            """,
            officer_id, body.title, body.competencies, body.pct, body.weight, body.item_count,
        )
    return {"recorded": True, "assessment_id": new_id}


@app.get("/api/analytics/summary")
async def analytics_summary():
    """Aggregates the database can honestly compute.

    Competency scoring stays in the browser — it depends on the role target
    matrix and the recency-decay model, which live in the engine. What SQL
    can answer truthfully is what has actually been recorded: completions
    and assessment outcomes, by role, station and competency.
    """
    pool = await db()
    async with pool.acquire() as con:
        by_role = await con.fetch(
            """
            SELECT r.id AS role_id, r.name AS role_name,
                   count(DISTINCT o.id)                       AS officers,
                   count(t.id)                                AS completions,
                   round(avg(t.score)::numeric, 1)            AS mean_score
            FROM roles r
            LEFT JOIN officers  o ON o.role_id = r.id
            LEFT JOIN trainings t ON t.officer_id = o.id
            GROUP BY r.id, r.name ORDER BY completions DESC NULLS LAST
            """
        )
        by_station = await con.fetch(
            """
            SELECT o.station, count(DISTINCT o.id) AS officers, count(t.id) AS completions
            FROM officers o LEFT JOIN trainings t ON t.officer_id = o.id
            WHERE o.station <> '' GROUP BY o.station ORDER BY completions DESC
            """
        )
        by_competency = await con.fetch(
            """
            SELECT comp AS competency_id,
                   count(*)                        AS attempts,
                   round(avg(a.pct)::numeric, 1)   AS mean_pct
            FROM assessments a, unnest(a.competencies) AS comp
            GROUP BY comp ORDER BY attempts DESC, comp
            """
        )
        popular = await con.fetch(
            """
            SELECT t.course_id, c.title, c.origin, count(*) AS completions
            FROM trainings t LEFT JOIN courses c ON c.id = t.course_id
            GROUP BY t.course_id, c.title, c.origin
            ORDER BY completions DESC, t.course_id LIMIT 10
            """
        )
    return {
        "by_role": [row_to_dict(r) for r in by_role],
        "by_station": [row_to_dict(r) for r in by_station],
        "assessment_by_competency": [row_to_dict(r) for r in by_competency],
        "most_completed": [row_to_dict(r) for r in popular],
    }


@app.get("/")
async def root():
    return Response(
        content=json.dumps(
            {
                "service": "SAMARTH API",
                "project": "SIH26101 · Team SPARK",
                "docs": "/docs",
                "health": "/health",
            },
            indent=1,
        ),
        media_type="application/json",
    )
