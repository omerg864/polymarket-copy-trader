# 🤖 Polymarket BTC 5-Minute Trading Bot

Automated trading bot for [Polymarket's BTC 5-minute up/down markets](https://polymarket.com/event/btc-updown-5m-1772654700). The bot analyzes real-time Bitcoin price momentum to predict whether BTC will go up or down in the next 5-minute window, then places trades accordingly.

**Features:**

- 📊 Technical analysis using RSI, EMA crossover, MACD, and Bollinger Bands on 1-minute candles
- 🎮 Demo mode (paper trading) — now uses **real-time CLOB prices** for accurate simulation
- 💰 Live mode — real trades on Polymarket via the CLOB API
- 💰 **Bot Allowance Limit** — unified virtual budget limit for both Live and Demo modes
- ⏯️ **Pause/Resume** — gracefully pause new trade entries while continuing to manage open positions
- 👨‍💻 **Web Dashboard** — real-time monitoring of trades, P&L, balance, and bot status
- 📈 **High-Price Sizing Bonus** — dynamically increases trade size for high-probability (high price) setups
- 🛡️ **Entry Guards** — configurable thresholds for minimum entry price and market age to filter trades
- 🗄️ Redis for persistent state, trade history, and stats
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
     │ Active trades, History, Balance, Cache    │
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

## Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd polymarket-5-minutes-bot
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings (demo mode works out of the box)

# 3. Start the bot and dashboard (separate terminals)
npm run start:demo       # Start the trading engine
npm run dashboard        # Start the web dashboard (port 3000)
npm run api              # Start the dashboard backend (port 3001)
```

## Usage

### Demo Mode (no real money)

```bash
npm run start:demo
# or
node src/index.js --demo
```

Demo mode starts with a virtual $100 USDC balance and simulates trades using real market data. No wallet or private key required.

### Live Mode (real money ⚠️)

> **WARNING**: Live mode trades with real USDC on Polygon. Only use funds you can afford to lose.

1. Set up your `.env` file:

    ```env
    MODE=live
    PRIVATE_KEY=0x_your_private_key
    FUNDER_ADDRESS=0x_your_polymarket_profile_address
    SIGNATURE_TYPE=0  # 0=MetaMask, 1=Magic/Email Login
    ```

2. Ensure your Polymarket account has USDC.e on Polygon.

3. Run:
    ```bash
    npm start
    # or
    node src/index.js --live
    ```

## Configuration

| Variable                   | Default                  | Description                                       |
| -------------------------- | ------------------------ | ------------------------------------------------- |
| `MODE`                     | `demo`                   | `demo` or `live`                                  |
| `BOT_ALLOWANCE`            | `100`                    | Virtual USDC budget the bot is allowed to use     |
| `MIN_ORDER_SIZE`           | `5`                      | Minimum USDC per trade                            |
| `MAX_ORDER_SIZE`           | `20`                     | Maximum USDC per trade (based on confidence)      |
| `HIGH_PRICE_THRESHOLD`     | `0.90`                   | Entry price above which the sizing bonus kicks in |
| `HIGH_PRICE_MAX_BONUS_PCT` | `1.0`                    | Max multiplier (+100%) for high-price trades      |
| `MIN_ENTRY_PRICE`          | `0.80`                   | Only enter trades with price >= this              |
| `MIN_MARKET_AGE_MINUTES`   | `2.0`                    | Only enter trades after X minutes of market age   |
| `PRIVATE_KEY`              | —                        | Wallet private key (live mode only)               |
| `FUNDER_ADDRESS`           | —                        | Polymarket profile address (live mode only)       |
| `SIGNATURE_TYPE`           | `0`                      | `0` = Browser wallet, `1` = Magic/email login     |
| `REDIS_URL`                | `redis://localhost:6379` | Redis connection string                           |
| `RISK_MONITOR_INTERVAL_MS` | `2000`                   | Milliseconds between TP/SL checks                 |
| `CONFIDENCE_THRESHOLD`     | `0.70`                   | Min signal confidence (0–1) to enter a trade      |
| `TAKE_PROFIT_PCT`          | `0.30`                   | Sell when price rises 30% from entry              |
| `STOP_LOSS_PCT`            | `0.20`                   | Sell when price drops 20% from entry              |
| `MAX_CONCURRENT_TRADES`    | `3`                      | Max simultaneous open positions                   |
| `LOG_LEVEL`                | `info`                   | `debug`, `info`, `warn`, `error`                  |

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
├── src/
│   ├── index.js              # Entry point, CLI parsing
│   ├── api.js                # Dashboard backend API
│   ├── config.js             # Environment config loader
│   ├── services/
│   │   ├── redis.js          # Redis state management
│   │   ├── polymarket.js     # Polymarket API (Gamma + CLOB)
│   │   ├── priceAnalysis.js  # BTC price analysis (Binance)
│   │   └── demoTrading.js    # Paper trading simulator
│   ├── strategy/
│   │   ├── engine.js         # Main trading loop
│   │   └── riskManager.js    # TP/SL position monitor
│   └── utils/
│       └── logger.js         # Winston logger
├── dashboard/                # React dashboard frontend
├── .env.example
├── .gitignore
├── package.json
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
