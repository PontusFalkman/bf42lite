# Infrastructure & Repo Layout (v1.3)

## Tree Overview
```text
bf42lite/
├─ apps/
│  └─ client-tauri/     # Renderer, client physics
├─ packages/
│  ├─ sim/              # Physics, movement, shared types
│  ├─ net/              # Networking helpers
│  ├─ protocol/         # Binary schemas
│  ├─ host-node/        # Dev-only host
│  └─ common/           # Shared utilities
├─ src-tauri/           # Rust Host (state, validation, relay)
├─ assets/
│  └─ tuning/           # Weapon + gameplay configs
└─ docs/                # Modular documentation