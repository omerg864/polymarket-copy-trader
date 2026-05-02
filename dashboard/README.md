# 📊 Polymarket Trading Dashboard

Modern web interface for monitoring and managing the Polymarket Copy Trader bot. Built with React, Vite, Tailwind CSS, shadcn/ui, and Framer Motion.

## Features

- **Real-time Monitoring**: Live updates of active trades, balance, and P&L.
- **Trade History**: Comprehensive view of all past trades with detailed metrics.
- **Strategy Management**: Live editing of bot configuration (wallets, order sizes, etc.).
- **Visual Analytics**: Interactive tables and cards showing market data and bot status.
- **Two-Tier Auth**: Secure login with Admin and Read-only modes.
- **Export**: Export trade history to Excel for offline analysis.

## Setup

```bash
# Install dependencies (if not done at root)
npm install

# Configure API URL
cp .env.example .env
# Edit VITE_API_URL if your backend is not on localhost:3001

# Start development server
npm run dev
```

## Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI)
- **State Management**: TanStack Query (React Query)
- **Icons**: Lucide React
- **Tables**: AG Grid
- **Date/Time**: Luxon
