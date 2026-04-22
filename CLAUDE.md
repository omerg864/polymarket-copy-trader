# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

TypeScript monorepo (npm workspaces) for an automated trading bot that bets on Polymarket's BTC 5-minute up/down prediction markets. Three runnable services plus a shared library:

- **`btc5-bot/`** — Trading engine (Node.js, runs continuously)
- **`api/`** — Express REST API (dashboard backend, read/write proxy for Redis/MongoDB)
- **`dashboard/`** — React/Vite frontend (shadcn/ui, Tailwind)
- **`shared/`** — Compiled TypeScript types/constants consumed by bot and API via `@shared/*` path alias

## Common Commands

### Development

```bash
# Start Redis (required for bot and API)
npm run redis:start

# Run bot in demo mode (watches for changes)
cd btc5-bot && npm run dev

# Run API server
cd api && npm run dev

# Run dashboard
npm run dashboard:dev
# or: cd dashboard && npm run dev
```

### Build

```bash
npm run build                   # Build all sub-projects in correct order (root)

cd shared && npm run build      # Must build shared first
cd btc5-bot && npm run build    # tsc + tsc-alias (resolves path aliases in output)
cd api && npm run build
cd dashboard && npm run build
```

### Lint

```bash
cd dashboard && npm run lint    # eslint (only dashboard has lint script)
```

### One-off utilities (root)

```bash
npm run redis:flush             # Flush all Redis keys
npm run demo:reset-run          # Flush Redis + clear logs + restart demo
npm run verify-stats            # Audit trade history vs. stored stats
```

## Architecture

### Runtime Data Flow

**Redis is the single source of truth at runtime.** All keys are prefixed `pmbot:` with a mode sub-namespace (`demo:` or `live:`). The bot owns all state writes; the API is a pure read/write proxy. Both services connect independently to the same Redis instance.

```
btc5-bot ──writes──→ Redis ←──reads/writes──→ api ←──reads/writes──→ dashboard
btc5-bot ──writes/reads──→ MongoDB ←──writes/reads──→ api
```

### Bot Execution Loop (`btc5-bot/src/strategy/engine.ts`)

Runs every 5 seconds (serial `setTimeout` chain, never concurrent). Each cycle:

1. Load strategy config (3-level cache: in-memory 10s → Redis → MongoDB)
2. Check stop flag in Redis
3. Resolve any expired open trades via BullMQ
4. Discover current 5-minute market via Polymarket's Gamma API
5. Compute signal from Binance 1-minute BTCUSDT klines (7 weighted indicators)
6. Apply guards: confidence threshold, price filters, concurrent trade limit, timing
7. Place order (demo: simulated; live: CLOB API)

### Signal Analysis (`btc5-bot/src/services/priceAnalysis.ts`)

Score is a weighted sum of 7 factors: distance from priceToBeat (weight 4), short-term momentum (3), micro RSI-5 (2), EMA micro-trend (2), VWAP (2), StochRSI (2), Bollinger Bands (2). Direction (UP/DOWN) is determined by the winning side. Confidence is a 0–100 float.

### Trade Lifecycle via BullMQ (`btc5-bot/src/services/queueService.ts`)

Two queues prevent race conditions when multiple positions exit simultaneously:

1. **`sell-trades`** (concurrency 5) — places CLOB sell order if applicable, then pushes to completion queue
2. **`trade-completion`** (concurrency 1) — serialized balance + stats updates, saves to mongoDB history, triggers Telegram notification

Risk manager runs two parallel intervals: position monitor (TP/SL checks every 2s) and FCT monitor (force-close if ≤13s remain on losing trade, every 1s).

### Config Layering

Strategy parameters live in MongoDB as key-value documents (`StrategyConfig` collection). The API does bulk upserts; the bot caches in Redis (no TTL) and in-memory (10s TTL). Live config changes from the dashboard take effect within ~10 seconds without a bot restart.

### Auth Model (API)

Two Bearer token tiers (passwords in env, not JWTs):

- **Admin** (`ADMIN_PASSWORD`): full write access (PUT config, POST stop/flush)
- **Readonly** (`READONLY_PASSWORD`): GET endpoints only
- **Internal bot** (`API_PASSWORD`): only the notification POST endpoint (`apiAuthGuard`)

### Demo Mode

All code paths branch on `config.isDemo`. Demo mode uses real Polymarket CLOB prices (read-only) with a simulated balance. P&L is tracked identically to live in Redis under the `demo:` namespace.

## Environment Variables

Each service has its own `.env` file. Key variables:

**`btc5-bot/.env`**

- `MODE` — `demo` (default) or `live`
- `PRIVATE_KEY`, `FUNDER_ADDRESS` — required only for live mode
- `REDIS_URL` — default `redis://localhost:6379`
- `MONGO_URI` — optional; disables strategy config persistence if absent
- `API_URL` / `API_PASSWORD` — for internal notification POSTs to the API

**`api/.env`**

- `MODE` — controls which Redis namespace (`demo:` or `live:`) to read
- `ADMIN_PASSWORD`, `READONLY_PASSWORD` — dashboard auth
- `REDIS_URL`, `MONGO_URI`
- `CLIENT_URL` — CORS origin (default `http://localhost:5173`)
- `TELEGRAM_BOT_TOKEN` — optional Telegram notifications

**`dashboard/.env`**

- `VITE_API_URL` — API base URL (default `http://localhost:3001`)

## Key Redis Key Patterns

All under `pmbot:` prefix:

- `pmbot:{mode}:balance` — current balance float string
- `pmbot:{mode}:stats` — BotStats JSON
- `pmbot:{mode}:active_trades` — set of active trade IDs
- `pmbot:{mode}:trade:{id}` — individual active trade JSON
- `pmbot:{mode}:history_ids` — sorted set of trade IDs (IDs only) for quick lookup
- `pmbot:{mode}:stop_requested` — pause flag (`"true"`/`"false"`)
- `pmbot:strategy_config` — cached strategy config JSON
- `pmbot:market:{conditionId}` — Gamma market cache (TTL 600s)

## Shared Package Path Alias

`@shared/*` resolves to `../shared/src/*` in both bot and API. After a `tsc` build, `tsc-alias` rewrites these imports in the output. If you add new files to `shared/`, rebuild it before running the other packages.

## Infrastructure

- **Redis** — run via `npm run redis:start` (docker-compose, `redis:7-alpine`, port 6379)
- **MongoDB** — not in docker-compose; run separately (local or Atlas)
- **BullMQ** — uses the same ioredis connection as other Redis operations

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **polymarket-5-minutes-bot** (1161 symbols, 2975 relationships, 85 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/polymarket-5-minutes-bot/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/polymarket-5-minutes-bot/context` | Codebase overview, check index freshness |
| `gitnexus://repo/polymarket-5-minutes-bot/clusters` | All functional areas |
| `gitnexus://repo/polymarket-5-minutes-bot/processes` | All execution flows |
| `gitnexus://repo/polymarket-5-minutes-bot/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
