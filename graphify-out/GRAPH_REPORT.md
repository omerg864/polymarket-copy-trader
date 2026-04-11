# Graph Report - .  (2026-04-10)

## Corpus Check
- 152 files · ~106,483 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 502 nodes · 718 edges · 76 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `RedisService` - 37 edges
2. `PolymarketService` - 16 edges
3. `PolymarketWsService` - 10 edges
4. `PolymarketPriceWsService` - 9 edges
5. `BinanceWsService` - 9 edges
6. `RDBParser` - 8 edges
7. `QueueService` - 8 edges
8. `DemoTradingService` - 8 edges
9. `TradeService` - 7 edges
10. `RiskManager` - 7 edges

## Surprising Connections (you probably didn't know these)
- `updateStrategyConfig()` --calls--> `getStrategyConfig()`  [EXTRACTED]
  api/src/services/strategyConfig.ts → btc5-bot/src/services/strategyConfig.ts
- `GitNexus` --references--> `Polymarket BTC 5-Minute Trading Bot`  [EXTRACTED]
  AGENTS.md → README.md

## Communities

### Community 0 - "UI & Dashboard Architecture"
Cohesion: 0.03
Nodes (4): AnalysisDashboard(), calculateStats(), fetchJson(), getAuthHeaders()

### Community 1 - "Bot Core Strategy & Services"
Cohesion: 0.07
Nodes (5): clearModeData(), setBotStartTime(), getStrategyConfig(), updateStrategyConfig(), VerificationService

### Community 2 - "Dashboard Controls & Modals"
Cohesion: 0.06
Nodes (0): 

### Community 3 - "Redis Service Layer"
Cohesion: 0.1
Nodes (1): RedisService

### Community 4 - "API Backend Logic"
Cohesion: 0.09
Nodes (2): authGuard(), resolveRole()

### Community 5 - "Alerting & Notification System"
Cohesion: 0.11
Nodes (4): getNotificationConfig(), isAuthenticatedChatId(), updateNotificationConfig(), TelegramService

### Community 6 - "Polymarket API Integration"
Cohesion: 0.16
Nodes (1): PolymarketService

### Community 7 - "Redis RDB Parsing Utility"
Cohesion: 0.38
Nodes (2): main(), RDBParser

### Community 8 - "Polymarket Real-time Feed (WS)"
Cohesion: 0.27
Nodes (1): PolymarketWsService

### Community 9 - "Polymarket Price Feed (WS)"
Cohesion: 0.39
Nodes (1): PolymarketPriceWsService

### Community 10 - "Binance Price Feed (WS)"
Cohesion: 0.28
Nodes (1): BinanceWsService

### Community 11 - "Background Job Queue (BullMQ)"
Cohesion: 0.29
Nodes (1): QueueService

### Community 12 - "Demo & Paper Trading Service"
Cohesion: 0.25
Nodes (1): DemoTradingService

### Community 13 - "Project Documentation & Design Rationale"
Cohesion: 0.25
Nodes (8): GitNexus, Impact Analysis Rationale, Dual Exit Rationale, Weighted Indicator Rationale, Polymarket BTC 5-Minute Trading Bot, Risk Manager, Technical Analysis Engine, Web Dashboard

### Community 14 - "Trade Data Management (MongoDB/Redis)"
Cohesion: 0.29
Nodes (1): TradeService

### Community 15 - "Risk Protection & Monitoring"
Cohesion: 0.43
Nodes (1): RiskManager

### Community 16 - "Trading Cycle Orchestration"
Cohesion: 0.43
Nodes (1): StrategyEngine

### Community 17 - "Technical Analysis & Signal Generation"
Cohesion: 0.47
Nodes (1): PriceAnalysisService

### Community 18 - "Internal Event Notifications"
Cohesion: 0.67
Nodes (1): NotificationManager

### Community 19 - "Redis Key Migration Logic"
Cohesion: 0.5
Nodes (0): 

### Community 20 - "Price & Outcome Synchronization"
Cohesion: 0.5
Nodes (1): OutcomeSyncService

### Community 21 - "Community 21 (mostly fix_stuck_trades_demo)"
Cohesion: 1.0
Nodes (2): getHistoricalPrice(), main()

### Community 22 - "Community 22 (mostly verify_stats)"
Cohesion: 1.0
Nodes (2): calculateFee(), main()

### Community 23 - "Database Migration (Redis to Mongo)"
Cohesion: 1.0
Nodes (2): main(), migrate()

### Community 24 - "Community 24 (mostly remove_extreme_trades)"
Cohesion: 1.0
Nodes (2): isExtremeOpposite(), main()

### Community 25 - "Community 25 (mostly sync_fees)"
Cohesion: 1.0
Nodes (2): calculateFee(), main()

### Community 26 - "Community 26 (mostly remove_low_confidence)"
Cohesion: 1.0
Nodes (2): main(), shouldRemove()

### Community 27 - "Community 27 (mostly find_opposite_trades)"
Cohesion: 1.0
Nodes (2): isOpposite(), main()

### Community 28 - "Community 28 (mostly inspect_last_trade)"
Cohesion: 1.0
Nodes (2): calculateFee(), main()

### Community 29 - "Community 29 (mostly fix_production_trades)"
Cohesion: 1.0
Nodes (2): getMarketOutcome(), main()

### Community 30 - "Community 30 (mostly sync_trades_outcome)"
Cohesion: 1.0
Nodes (2): getMarketOutcome(), main()

### Community 31 - "Community 31 (mostly test_gamma_find)"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32 (mostly test_gamma)"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33 (mostly test_gamma2)"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34 (mostly test_redis_trades)"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35 (mostly simulate_sizes)"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36 (mostly test_binance)"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37 (mostly analyze_logs)"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38 (mostly test_redis)"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39 (mostly resolve_via_queue)"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40 (mostly delete_trade)"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41 (mostly resolve_stuck_trade)"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42 (mostly investigate_stuck_trades)"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43 (mostly inspect_redis)"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44 (mostly simulate_combined_sl_fixed)"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45 (mostly migrate_redis_keys)"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46 (mostly simulate_sl_adjustment)"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47 (mostly inspect_queue_stuck)"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48 (mostly migrate_history_ids)"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49 (mostly fix_stats)"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50 (mostly force_resolve)"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51 (mostly fix_missing_exit_price)"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52 (mostly sync_versions)"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53 (mostly check_history)"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54 (mostly simulate_fixed_cost)"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55 (mostly check_gamma_api)"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56 (mostly fix_and_analyze)"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57 (mostly inspect_trades)"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58 (mostly redis_test)"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59 (mostly sync_history_ids)"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60 (mostly simulate_sl_market_price)"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61 (mostly vite_config)"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62 (mostly main)"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63 (mostly env_d)"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64 (mostly readme_trading_modes)"
Cohesion: 1.0
Nodes (1): Demo and Live Modes

### Community 65 - "Community 65 (mostly readme_strategy_config_service)"
Cohesion: 1.0
Nodes (1): Live Strategy Config

### Community 66 - "Community 66 (mostly readme_fixed_trade_cost_rationale)"
Cohesion: 1.0
Nodes (1): Fixed Cost Rationale

### Community 67 - "Community 67 (mostly dashboard/public/favicon-16x16.png)"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68 (mostly dashboard/public/maskable_icon_x192.png)"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69 (mostly dashboard/public/maskable_icon.png)"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70 (mostly dashboard/public/android-chrome-192x192.png)"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71 (mostly dashboard/public/apple-touch-icon.png)"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72 (mostly dashboard/public/vite.svg)"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73 (mostly dashboard/public/android-chrome-512x512.png)"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74 (mostly dashboard/public/maskable_icon_x512.png)"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Community 75 (mostly dashboard/public/favicon-32x32.png)"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **7 isolated node(s):** `Demo and Live Modes`, `Web Dashboard`, `Live Strategy Config`, `Fixed Cost Rationale`, `Weighted Indicator Rationale` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 31 (mostly test_gamma_find)`** (2 nodes): `test_gamma_find.js`, `test()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32 (mostly test_gamma)`** (2 nodes): `test_gamma.js`, `test()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33 (mostly test_gamma2)`** (2 nodes): `test_gamma2.js`, `test()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34 (mostly test_redis_trades)`** (2 nodes): `test-redis-trades.js`, `check()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35 (mostly simulate_sizes)`** (2 nodes): `simulate_sizes.js`, `simulate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36 (mostly test_binance)`** (2 nodes): `test_binance.js`, `test()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37 (mostly analyze_logs)`** (2 nodes): `analyze_logs.js`, `analyze()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38 (mostly test_redis)`** (2 nodes): `test-redis.js`, `test()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39 (mostly resolve_via_queue)`** (2 nodes): `resolve-via-queue.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40 (mostly delete_trade)`** (2 nodes): `delete-trade.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41 (mostly resolve_stuck_trade)`** (2 nodes): `resolve-stuck-trade.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42 (mostly investigate_stuck_trades)`** (2 nodes): `investigate-stuck-trades.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43 (mostly inspect_redis)`** (2 nodes): `inspect-redis.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44 (mostly simulate_combined_sl_fixed)`** (2 nodes): `simulate-combined-sl-fixed.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45 (mostly migrate_redis_keys)`** (2 nodes): `migrate-redis-keys.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46 (mostly simulate_sl_adjustment)`** (2 nodes): `simulate-sl-adjustment.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47 (mostly inspect_queue_stuck)`** (2 nodes): `inspect-queue-stuck.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48 (mostly migrate_history_ids)`** (2 nodes): `migrate-history-ids.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49 (mostly fix_stats)`** (2 nodes): `fix-stats.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50 (mostly force_resolve)`** (2 nodes): `force-resolve.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51 (mostly fix_missing_exit_price)`** (2 nodes): `fix-missing-exit-price.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52 (mostly sync_versions)`** (2 nodes): `sync-versions.ts`, `syncVersions()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53 (mostly check_history)`** (2 nodes): `check-history.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54 (mostly simulate_fixed_cost)`** (2 nodes): `simulate-fixed-cost.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55 (mostly check_gamma_api)`** (2 nodes): `check-gamma-api.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56 (mostly fix_and_analyze)`** (2 nodes): `fix-and-analyze.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57 (mostly inspect_trades)`** (2 nodes): `inspect-trades.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58 (mostly redis_test)`** (2 nodes): `redis-test.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59 (mostly sync_history_ids)`** (2 nodes): `sync-history-ids.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60 (mostly simulate_sl_market_price)`** (2 nodes): `simulate-sl-market-price.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61 (mostly vite_config)`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62 (mostly main)`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63 (mostly env_d)`** (1 nodes): `env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64 (mostly readme_trading_modes)`** (1 nodes): `Demo and Live Modes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65 (mostly readme_strategy_config_service)`** (1 nodes): `Live Strategy Config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66 (mostly readme_fixed_trade_cost_rationale)`** (1 nodes): `Fixed Cost Rationale`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67 (mostly dashboard/public/favicon-16x16.png)`** (1 nodes): `favicon-16x16.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68 (mostly dashboard/public/maskable_icon_x192.png)`** (1 nodes): `maskable_icon_x192.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69 (mostly dashboard/public/maskable_icon.png)`** (1 nodes): `maskable_icon.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70 (mostly dashboard/public/android-chrome-192x192.png)`** (1 nodes): `android-chrome-192x192.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71 (mostly dashboard/public/apple-touch-icon.png)`** (1 nodes): `apple-touch-icon.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72 (mostly dashboard/public/vite.svg)`** (1 nodes): `vite.svg`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73 (mostly dashboard/public/android-chrome-512x512.png)`** (1 nodes): `android-chrome-512x512.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74 (mostly dashboard/public/maskable_icon_x512.png)`** (1 nodes): `maskable_icon_x512.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75 (mostly dashboard/public/favicon-32x32.png)`** (1 nodes): `favicon-32x32.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RedisService` connect `Redis Service Layer` to `Bot Core Strategy & Services`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `PolymarketService` connect `Polymarket API Integration` to `Bot Core Strategy & Services`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `PolymarketWsService` connect `Polymarket Real-time Feed (WS)` to `Bot Core Strategy & Services`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `Demo and Live Modes`, `Web Dashboard`, `Live Strategy Config` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI & Dashboard Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Bot Core Strategy & Services` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Dashboard Controls & Modals` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._