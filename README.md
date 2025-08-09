# Hive Feed Price Tool

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)  
[![Node.js](<https://img.shields.io/badge/Node.js-%E2%89%A520%20(recommended%2022)-green.svg>)](https://nodejs.org/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Tool for Hive witnesses to automatically publish feed prices using @hiveio/wax and @hiveio/beekeeper.**

## 🚀 Quick Start

```bash
git clone https://github.com/enrique89ve/hivefeedprice.git
cd hive-feed-price
cp .env.example .env  # Configure your credentials
./run.sh install     # Install Node.js (min 20; targets 22 with NVM), pnpm and dependencies
./run.sh start       # Start the application
```

## 📋 Commands

```bash
./run.sh install    # Install complete environment
./run.sh start      # Start application
./run.sh stop       # Stop application
./run.sh restart    # Restart application
./run.sh logs       # View real-time logs
./run.sh status     # Show status
./run.sh clean      # Clean logs and PID files
```

## ⚙️ Requirements & Configuration

Minimum runtime versions:

- Node.js: >= 20 (recommended 22; the installer will use NVM and set 22 by default)
- pnpm: managed via Corepack (installed/enabled automatically)

### Environment variables (.env)

You can start from `.env.example`:

```bash
cp .env.example .env
# then edit .env with your account and key
```

```bash
HIVE_WITNESS_ACCOUNT=your-witness-account
HIVE_PRIVATE_KEY=5J7cSr3Yv4nKwYour1PrivateKey2Here3...
FEED_INTERVAL=10min          # 3min, 10min, 30min, 1hour
HIVE_RPC_NODES=https://api.hive.blog,https://api.deathwing.me
```

### Supported exchanges

- **Binance**, **Bitget**, **Huobi**, **MEXC**, **Probit**
- Configurable in `src/providers/static-providers.ts`

## 🔧 Development

```bash
pnpm dev             # Development with hot reload
pnpm build           # Compile TypeScript
pnpm test            # Run tests
pnpm lint            # Linter
pnpm typecheck       # Type checking
```

## 📋 Features

- ✅ **Automatic installation** with NVM and Node.js (targets 22; works with >= 20)
- ✅ **100% TypeScript** with strict types
- ✅ **Path mapping** `@/*` to `src/*`
- ✅ **Secure key management** with @hiveio/beekeeper
- ✅ **Multi-exchange** with configurable weights
- ✅ **Retry logic** and error handling
- ✅ **Background process** with nohup

## 🛡️ Security

- Private keys handled with @hiveio/beekeeper (encrypted)
- Environment variables with Node.js native support (.env)
- Temporary in-memory wallets for maximum security

---
