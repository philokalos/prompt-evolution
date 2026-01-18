# Desktop Shared Module

This folder contains **Desktop-specific extensions** to the shared core types and constants.

## Structure

```
desktop/src/shared/
├── types.ts      # Re-exports from src/shared/types + Desktop-specific types
└── constants.ts  # Desktop-specific UI constants (GOLDEN_EXPLANATIONS, etc.)
```

## Design Pattern

- **types.ts**: Re-exports common types from `../../../src/shared/types/index.js` and adds Desktop-specific types like `UserSettings`
- **constants.ts**: Contains UI-specific constants for the Electron renderer (not shared with CLI/Dashboard)

## Usage

```typescript
// In Desktop renderer components
import { UserSettings, AnalysisResult } from '@shared/types';
import { GOLDEN_EXPLANATIONS } from '@shared/constants';
```

## Relationship with src/shared/

| Location | Purpose |
|----------|---------|
| `src/shared/` | Common types/constants (CLI, Dashboard, Desktop via re-export) |
| `desktop/src/shared/` | Desktop-specific extensions (Electron UI only) |

The vite.config.ts alias `@shared` points to this folder (`desktop/src/shared`).
