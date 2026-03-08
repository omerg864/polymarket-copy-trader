# 🤖 Polymarket BTC 5-Minute Trading Bot

Automated trading bot for [Polymarket's BTC 5-minute up/down markets](https://polymarket.com/event/btc-updown-5m-1772654700). The bot analyzes real-time Bitcoin price momentum to predict whether BTC will go up or down in the next 5-minute window, then places trades accordingly.

**Features:**

- 📊 Technical analysis using RSI, EMA crossover, MACD, and Bollinger Bands on 1-minute candles
- 🎮 Demo mode (paper trading) — uses **real-time CLOB prices** for accurate simulation
- 💰 Live mode — real trades on Polymarket via the CLOB API
- 💰 **Bot Allowance Limit** — unified virtual budget limit for both Live and Demo modes
- ⏯️ **Pause/Resume** — gracefully pause new trade entries while continuing to manage open positions
- 👨‍💻 **Web Dashboard** — real-time monitoring of trades, P&L, balance, and bot status
- 🔒 **Two-Tier Auth** — admin (full control) and read-only (view only) access
- ⚙️ **Live Strategy Config** — all strategy parameters stored in MongoDB, editable from the dashboard, cached in Redis, and picked up by the bot automatically
- 📈 **High-Price Sizing Bonus** — dynamically increases trade size for high-probability (high price) setups
- 🛡️ **Entry Guards** — configurable thresholds for minimum entry price and market age to filter trades
- 🗄️ Redis for persistent state, trade history, stats, and strategy config cache
- 🍃 MongoDB for durable strategy configuration
- 🔄 Auto-aligns to 5-minute market intervals

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Strategy Engine                      │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │ Price Analysis│  │  Polymarket │  │  Risk Manager  │   │
│  │ (Binance API) │  │  (CLOB API) │  │  (TP / SL)     │   │
│  └──────┬───────┘  └──────┬─────┘  └──────┬─────────┘   │
│         │                 │               │              │
│  RSI, EMA, MACD    Market Discovery   Position Monitor   │
│  Bollinger Bands   Order Placement    Auto-Sell Exits    │
└─────────┬─────────────────┬───────────────┬──────────────┘
          │                 │               │
     ┌────▼─────────────────▼───────────────▼───┐
     │                 Redis                     │
     │ Active trades, History, Balance, Cache,   │
     │ Strategy Config (cache from MongoDB)      │
     └──────────────────┬───────────────────────┘
                        │
     ┌──────────────────▼───────────────────────┐
     │              API Server                   │
     │ Express + Mongoose — REST endpoints,      │
     │ strategy config CRUD, two-tier auth       │
     └──────────────────┬───────────────────────┘
                        │
     ┌──────────────────▼───────────────────────┐
     │              MongoDB                      │
     │ Durable strategy config (key/value)       │
     └──────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** ≥ 18
- **Redis** — install and start:

    ```bash
    # macOS
    brew install redis
    redis-server

    # Ubuntu/Debian
    sudo apt install redis-server
    sudo systemctl start redis

    # Docker
    docker run -d -p 6379:6379 redis
    ```

- **MongoDB** — install and start:

    ```bash
    # macOS
    brew tap mongodb/brew
    brew install mongodb-community
    brew services start mongodb-community

    # Docker
    docker run -d -p 27017:27017 mongo

    # Or use MongoDB Atlas (cloud) — set MONGO_URI in api/.env
    ```

## Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd polymarket-5-minutes-bot
npm install

# 2. Build shared types
cd shared && npm run build && cd ..

# 3. Configure environment
cp btc5-bot/.env.example btc5-bot/.env
cp api/.env.example api/.env
cp dashboard/.env.example dashboard/.env
# Edit .env files with your settings (demo mode works out of the box)

# 4. Start services (separate terminals)
cd api && npm run dev             # API server (port 3001) — connects to MongoDB & Redis
cd btc5-bot && npm run dev        # Trading engine (demo mode)
cd dashboard && npm run dev       # Web dashboard (port 5173)
```

## Usage

### Demo Mode (no real money)

```bash
cd btc5-bot
npm run dev
# or (after building)
npm run start:demo
```

Demo mode starts with a virtual $100 USDC balance and simulates trades using real market data. No wallet or private key required.

### Live Mode (real money ⚠️)

> **WARNING**: Live mode trades with real USDC on Polygon. Only use funds you can afford to lose.

1. Set up your `btc5-bot/.env` file:

    ```env
    MODE=live
    PRIVATE_KEY=0x_your_private_key
    FUNDER_ADDRESS=0x_your_polymarket_profile_address
    SIGNATURE_TYPE=0  # 0=MetaMask, 1=Magic/Email Login
    ```

2. Ensure your Polymarket account has USDC.e on Polygon.

3. Run:
    ```bash
    cd btc5-bot
    npm start
    ```

## Configuration

### Environment Variables

The project uses three `.env` files — one per package. Only infrastructure and credentials live in env vars; all **trading strategy parameters** are managed in MongoDB and editable from the dashboard.

#### `btc5-bot/.env`

| Variable         | Default                  | Description                                   |
| ---------------- | ------------------------ | --------------------------------------------- |
| `MODE`           | `demo`                   | `demo` or `live`                              |
| `PRIVATE_KEY`    | —                        | Wallet private key (live mode only)           |
| `FUNDER_ADDRESS` | —                        | Polymarket profile address (live mode only)   |
| `SIGNATURE_TYPE` | `0`                      | `0` = Browser wallet, `1` = Magic/email login |
| `REDIS_URL`      | `redis://localhost:6379` | Redis connection string                       |
| `LOG_LEVEL`      | `info`                   | `debug`, `info`, `warn`, `error`              |

#### `api/.env`

| Variable            | Default                                    | Description                   |
| ------------------- | ------------------------------------------ | ----------------------------- |
| `MODE`              | `demo`                                     | `demo` or `live`              |
| `API_PORT`          | `3001`                                     | Express server port           |
| `ADMIN_PASSWORD`    | —                                          | Password for admin access     |
| `READONLY_PASSWORD` | —                                          | Password for read-only access |
| `REDIS_URL`         | `redis://localhost:6379`                   | Redis connection string       |
| `MONGO_URI`         | `mongodb://localhost:27017/polymarket-bot` | MongoDB connection string     |
| `CLIENT_URL`        | `http://localhost:5173`                    | Dashboard origin (CORS)       |

#### `dashboard/.env`

| Variable       | Default                 | Description    |
| -------------- | ----------------------- | -------------- |
| `VITE_API_URL` | `http://localhost:3001` | API server URL |

### Strategy Config (MongoDB)

All trading strategy parameters are stored in MongoDB and cached in Redis. They can be edited live from the dashboard by admin users. The bot picks up changes automatically (within ~10 seconds).

| Parameter               | Default | Description                                       |
| ----------------------- | ------- | ------------------------------------------------- |
| `minOrderSizeUsd`       | `5`     | Minimum USDC per trade                            |
| `maxOrderSizeUsd`       | `20`    | Maximum USDC per trade (scaled by confidence)     |
| `confidenceThreshold`   | `0.70`  | Min signal confidence (0–1) to enter a trade      |
| `takeProfitPct`         | `0.30`  | Sell when price rises 30% from entry              |
| `stopLossPct`           | `0.20`  | Sell when price drops 20% from entry              |
| `maxConcurrentTrades`   | `3`     | Max simultaneous open positions                   |
| `minEntryPrice`         | `0.80`  | Only enter trades with price ≥ this               |
| `minMarketAgeMinutes`   | `2.0`   | Only enter trades after X minutes of market age   |
| `candleCount`           | `60`    | Number of 1-minute candles to fetch for analysis  |
| `rsiPeriod`             | `14`    | RSI calculation period                            |
| `emaFast`               | `9`     | Fast EMA period                                   |
| `emaSlow`               | `21`    | Slow EMA period                                   |
| `riskMonitorIntervalMs` | `2000`  | Milliseconds between TP/SL checks                 |
| `botAllowance`          | `100`   | Virtual USDC budget the bot is allowed to use     |
| `highPriceThreshold`    | `0.90`  | Entry price above which the sizing bonus kicks in |
| `highPriceMaxBonusPct`  | `1.0`   | Max multiplier (+100%) for high-price trades      |

## How the Strategy Works

### Signal Generation

The bot fetches the last 60 one-minute BTC/USDT candles from Binance and computes:

1. **RSI (14)** — Identifies oversold (<30, bullish) and overbought (>70, bearish) conditions
2. **EMA Crossover (9/21)** — Detects fresh trend changes and current trend direction
3. **MACD (12/26/9)** — Confirms momentum direction via histogram and signal line
4. **Price Momentum** — Last 5 candles' directional change
5. **Bollinger Bands (20/2)** — Mean reversion signals at band extremes
6. **Volume** — High volume confirms the dominant signal

Each indicator contributes a weighted score. The direction with the highest total wins, and the confidence equals the winning score divided by the total.

### Trade Management

Once a position is entered:

- The **risk manager** monitors the position every 10 seconds
- If the position rises by `TAKE_PROFIT_PCT` (default 30%), it auto-sells for profit
- If the position drops by `STOP_LOSS_PCT` (default 20%), it auto-sells to limit losses
- If neither threshold is hit, the position rides to market resolution (5-minute window end)

### Market Timing

The bot aligns its cycle to 5-minute intervals, attempting to analyze and enter positions ~30 seconds before each market window opens. This ensures the signal reflects the most current BTC price action.

## Project Structure

```
polymarket-5-minutes-bot/
├── shared/                    # Shared TypeScript types & constants
│   └── src/
│       ├── index.ts
│       └── types.ts           # Trade, Market, Signal, StrategyConfig, defaults
├── btc5-bot/                  # Trading engine (TypeScript)
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Entry point, CLI parsing
│       ├── stop.ts            # Graceful stop script
│       ├── config.ts          # Environment config (mode, credentials, Redis)
│       ├── services/
│       │   ├── redis.ts       # Redis state management
│       │   ├── strategyConfig.ts # Strategy config from Redis/MongoDB
│       │   ├── polymarket.ts  # Polymarket API (Gamma + CLOB)
│       │   ├── priceAnalysis.ts # BTC price analysis (Binance)
│       │   └── demoTrading.ts # Paper trading simulator
│       ├── strategy/
│       │   ├── engine.ts      # Main trading loop
│       │   └── riskManager.ts # TP/SL position monitor
│       └── utils/
│           └── logger.ts      # Winston logger
├── api/                       # Dashboard backend API (TypeScript)
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Express server entry (+ MongoDB connect)
│       ├── config.ts          # API config (auth, Redis, Mongo, port)
│       ├── models/
│       │   └── StrategyConfig.ts # Mongoose key/value model
│       ├── controllers/
│       │   └── bot.controller.ts
│       ├── middleware/
│       │   ├── auth.ts        # Two-tier auth (admin/readonly)
│       │   └── errorHandler.ts
│       ├── routes/
│       │   └── bot.routes.ts
│       └── services/
│           ├── redis.ts
│           └── strategyConfig.ts # CRUD with Redis cache
├── dashboard/                 # React dashboard frontend
│   ├── .env.example
├── tests/                     # Test scripts
├── docker-compose.yml         # Redis service
├── .gitignore
├── package.json               # Workspace root
└── README.md
```

## Logs

- `logs/bot.log` — All bot activity
- `logs/trades.log` — Trade entries, exits, and P&L (JSON format)
- Console output includes color-coded trade signals and status

## Disclaimer

> **⚠️ This bot is for educational and experimental purposes.** Trading on prediction markets involves significant risk. Past performance does not guarantee future results. Never trade with money you cannot afford to lose. The authors are not responsible for any financial losses.

## License

MIT
