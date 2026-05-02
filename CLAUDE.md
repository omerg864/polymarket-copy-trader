# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

TypeScript monorepo (npm workspaces) for an automated Polymarket Copy Trader bot that follows target wallets. Three runnable services plus a shared library:

- **`copy-bot/`** — Trading engine (Node.js, polls target wallets for trades)
- **`api/`** — Express REST API (dashboard backend, read/write proxy for Redis/MongoDB)
- **`dashboard/`** — React/Vite frontend (shadcn/ui, Tailwind, Framer Motion)
- **`shared/`** — Compiled TypeScript types/constants consumed by bot and API via `@shared/*` path alias

## Common Commands

### Development

```bash
# Start Redis (required for bot and API)
npm run redis:start

# Run bot (watches for changes)
cd copy-bot && npm run dev

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
cd copy-bot && npm run build    # tsc + tsc-alias
cd api && npm run build
cd dashboard && npm run build
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
copy-bot ──writes──→ Redis ←──reads/writes──→ api ←──reads/writes──→ dashboard
copy-bot ──writes/reads──→ MongoDB ←──writes/reads──→ api
```

### Bot Execution Loop (`copy-bot/src/strategy/engine.ts`)

Runs every few seconds (configurable via `cycleIntervalMs`). Each cycle:

1. Load strategy config (3-level cache: in-memory 10s → Redis → MongoDB)
2. Check stop flag in Redis
3. Resolve any expired open trades via `OutcomeSyncService`
4. Poll target wallets for new trades via `CopyTraderService`
5. Mirror BUY orders: discovery of market via Gamma API, position entry
6. Mirror SELL orders: check for wallet exits and close corresponding internal positions
7. Apply guards: fixed order size, concurrent trade limit, timing exclusions

### Copy Logic (`copy-bot/src/services/copyTrader.ts`)

Fetches the latest activities for configured target wallets. It identifies:
- **BUY activities**: Triggers a mirrored buy if not already in position for that wallet/token.
- **SELL activities**: Triggers a mirrored sell to exit the specific position tied to that wallet/token.

### Trade Lifecycle via BullMQ (`copy-bot/src/services/queueService.ts`)

Two queues prevent race conditions:

1. **`sell-trades`** (concurrency 5) — places CLOB sell order if applicable, then pushes to completion queue.
2. **`trade-completion`** (concurrency 1) — serialized balance + stats updates, saves to MongoDB history, triggers Telegram/dashboard notifications.

### Risk Management (`copy-bot/src/strategy/riskManager.ts`)

Monitors open positions. Since this is a copy trader, the primary exit signal is the target wallet's SELL activity. However, it also handles market resolution and provides hooks for potential manual overrides.

### Config Layering

Strategy parameters live in MongoDB as key-value documents (`StrategyConfig` collection). The API does bulk upserts; the bot caches in Redis (no TTL) and in-memory (10s TTL). Live config changes from the dashboard take effect within ~10 seconds.

## Environment Variables

**`copy-bot/.env`**

- `MODE` — `demo` (default) or `live`
- `PRIVATE_KEY`, `FUNDER_ADDRESS` — required only for live mode
- `SIGNATURE_TYPE` — `0` (MetaMask) or `1` (Magic/Email)
- `REDIS_URL`, `MONGO_URI`
- `API_URL` / `API_PASSWORD` — for notifications

**`api/.env`**

- `ADMIN_PASSWORD`, `READONLY_PASSWORD` — dashboard auth
- `REDIS_URL`, `MONGO_URI`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — for alerts

## Key Redis Key Patterns

- `pmbot:{mode}:balance` — current balance
- `pmbot:{mode}:stats` — BotStats JSON
- `pmbot:{mode}:active_trades` — set of active trade IDs
- `pmbot:{mode}:trade:{id}` — individual active trade JSON
- `pmbot:{mode}:history_ids` — trade history lookup
- `pmbot:strategy_config` — cached configuration

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **polymarket-copy-trader**. Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

... (rest of GitNexus content preserved)

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **polymarket-copy-trader** (1042 symbols, 2766 relationships, 72 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
3. `READ gitnexus://repo/polymarket-copy-trader/process/{processName}` — trace the full execution flow step by step
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
| `gitnexus://repo/polymarket-copy-trader/context` | Codebase overview, check index freshness |
| `gitnexus://repo/polymarket-copy-trader/clusters` | All functional areas |
| `gitnexus://repo/polymarket-copy-trader/processes` | All execution flows |
| `gitnexus://repo/polymarket-copy-trader/process/{name}` | Step-by-step execution trace |

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
