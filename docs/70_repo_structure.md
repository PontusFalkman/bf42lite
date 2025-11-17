# Infrastructure & Repo Layout (v1.4)

## Tree Overview

```text
bf42lite/
├── .gitattributes
├── .gitignore
├── README.md
├── bf_42_lite_simplified_docs.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   └── client-tauri/
│       ├── src/          # TypeScript client: rendering, input, prediction
│       ├── src-tauri/    # Rust host: state, validation, relay (inside the app)
│       ├── public/       # Static assets (models, etc.)
│       └── dist/         # Built client bundle
├── packages/
│   ├── sim/              # Shared ECS simulation: movement, health, etc.
│   ├── net/              # Networking adapters (loopback, WebSocket)
│   ├── protocol/         # Binary schemas and helpers
│   └── host-node/        # Dev-only Node host
└── docs/                 # Modular design + backlog docs
