# 🤖 Polymarket Copy Trader Bot

Automated copy-trading bot for [Polymarket](https://polymarket.com). The bot follows specific target wallets (whales) and mirrors their trades in real-time. It supports both Demo (simulated) and Live (real funds) modes with a comprehensive web dashboard for monitoring.

**Features:**

- 🐋 **Wallet Mirroring** — Follow specific Polymarket wallets and copy their BUY and SELL actions.
- 🏷️ **Nickname Support** — Assign nicknames to target wallets for easy identification.
- 🎮 **Demo Mode (Paper Trading)** — Uses **real-time CLOB prices** to simulate trades without real money.
- 💰 **Live Mode** — Executes real trades on Polymarket via the CLOB API.
- ⏯️ **Pause/Resume** — Gracefully pause new entries while continuing to manage open positions.
- 👨‍💻 **Web Dashboard** — Real-time monitoring of active trades, P&L, balance, and wallet activity.
- 🔒 **Two-Tier Auth** — Admin (full control) and Read-only (view only) access.
- 🍃 **Durable Persistence** — Trade history and strategy configuration persisted in MongoDB and cached in Redis.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                     Strategy Engine                      │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │ Copy Trader  │  │  Polymarket │  │  Risk Manager  │   │
│  │ (Wallet Poll) │  │  (CLOB API) │  │ (Sync & Exits) │   │
│  └──────┬───────┘  └──────┬─────┘  └──────┬─────────┘   │
│         │                 │               │              │
│   New Activities     Order Placement    Position Monitor  │
│   Mirror BUY/SELL    Market Discovery   Auto-Sync Exits   │
└─────────┬─────────────────┬───────────────┬──────────────┘
          │                 │               │
      ┌────▼─────────────────▼───────────────▼───┐
      │                 Redis                     │
      │ Active trades, Balance, Cache,            │
      │ Strategy Cache, History ID Set (lookup)   │
      └──────────────────┬───────────────────────┘
                         │
      ┌──────────────────▼───────────────────────┐
      │              API Server                   │
      │ Express + Mongoose — REST endpoints,      │
      │ strategy management, trade history access │
      └──────────────────┬───────────────────────┘
                         │
      ┌──────────────────▼───────────────────────┐
      │              MongoDB                      │
      │ Strategy Config, Trade History (full)     │
      └──────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** ≥ 18
- **Redis** — `brew install redis` or `docker run -d -p 6379:6379 redis`
- **MongoDB** — `brew install mongodb-community` or `docker run -d -p 27017:27017 mongo`

## Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd polymarket-copy-trader
npm install

# 2. Build shared types
cd shared && npm run build && cd ..

# 3. Configure environment
cp copy-bot/.env.example copy-bot/.env
cp api/.env.example api/.env
cp dashboard/.env.example dashboard/.env
# Edit .env files with your settings

# 4. Start services (separate terminals or use a task runner)
cd api && npm run dev             # API server (port 3001)
cd copy-bot && npm run dev        # Trading engine
cd dashboard && npm run dev       # Web dashboard (port 5173)
```

## Usage

### Demo Mode (Paper Trading)
Demo mode starts with a virtual balance and simulates trades using real market data. Set `MODE=demo` in `copy-bot/.env`.

### Live Mode (Real Money ⚠️)
1. Set `MODE=live` in `copy-bot/.env`.
2. Configure `PRIVATE_KEY`, `FUNDER_ADDRESS`, and `SIGNATURE_TYPE`.
3. Run `npm start` in the `copy-bot` directory.

## Configuration (MongoDB)

All trading parameters are stored in MongoDB and editable from the dashboard:

| Parameter | Default | Description |
| --------- | ------- | ----------- |
| `fixedOrderSizeUsd` | `100` | Fixed USDC amount per copied trade |
| `maxConcurrentTrades` | `5` | Maximum number of active trades allowed |
| `wallets` | `[]` | List of wallet objects `{address, nickname}` to follow |
| `isBotPaused` | `false` | Global pause flag for trade entries |

## Project Structure

- `shared/`: Shared TypeScript types and constants.
- `copy-bot/`: The core trading engine that polls wallets and mirrors trades.
- `api/`: Express server providing data to the dashboard and persisting config.
- `dashboard/`: Modern React dashboard for monitoring and management.

## Disclaimer

> **⚠️ This bot is for educational and experimental purposes.** Trading on prediction markets involves significant risk. Never trade with money you cannot afford to lose. The authors are not responsible for any financial losses.

## License
MIT
