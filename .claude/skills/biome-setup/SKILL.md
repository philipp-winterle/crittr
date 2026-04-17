---
name: biome-setup
description: Biome-Konfiguration für crittr — ersetzt ESLint + Prettier + sort-destructure-keys. Nutze diesen Skill beim Einrichten von biome.json, beim Entfernen von ESLint/Prettier-Deps, beim Mappen bestehender Regeln auf Biome-Äquivalente, oder wenn Husky-Hooks auf Biome umgestellt werden.
---

# Biome Setup für crittr

## Ziel-Tooling
- **Linter + Formatter**: Biome (@biomejs/biome)
- **Entfernt**: eslint, eslint-config-prettier, eslint-plugin-sort-destructure-keys, prettier

## biome.json (Ziel-Template)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "files": {
    "ignore": ["dist", "node_modules", "test/results", "test/data"]
  },
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 4,
    "lineWidth": 120,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "asNeeded",
      "bracketSpacing": true
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useConst": "error",
        "useTemplate": "warn",
        "noNonNullAssertion": "warn"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      },
      "complexity": {
        "noForEach": "off"
      }
    }
  }
}
```

**Indent/Quote-Werte** aus bestehender Prettier-Config übernehmen — prüfe `.prettierrc*` vor dem Schreiben.

## Regel-Mapping ESLint → Biome
| ESLint-Regel | Biome-Äquivalent | Notiz |
|--------------|------------------|-------|
| `sort-destructure-keys/sort-destructure-keys` | `useSortedKeys` (style) | Syntax leicht anders, Intention gleich |
| `no-unused-vars` | `noUnusedVariables` (correctness) | |
| `prefer-const` | `useConst` (style) | |
| `no-console` | `noConsoleLog` (suspicious) | opt-in |
| Prettier-Formatting | `formatter` block | nativ |

## package.json Scripts
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit"
  }
}
```

## devDependencies
**Hinzufügen**: `@biomejs/biome`, `typescript`, `@types/node`
**Entfernen**: `eslint`, `eslint-config-prettier`, `eslint-plugin-sort-destructure-keys`, `prettier`

## Husky-Hook
`.husky/pre-commit`:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx biome check --write --no-errors-on-unmatched --staged
```

## tsconfig.json (Ziel)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "allowJs": true,
    "checkJs": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "lib",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["lib/**/*.ts", "lib/**/*.js", "index.ts"],
  "exclude": ["node_modules", "dist", "test", "examples"]
}
```

## Validierung
1. `npx biome check .` — listet (erlaubte) Initial-Violations.
2. `npx tsc --noEmit` — muss grün sein (weil noch keine TS-Files existieren; sobald welche kommen, prüft tsc).
3. `npm test` — unverändert grün.

## Nicht tun
- Kein `"include": ["**/*"]` — überladen.
- Kein `checkJs: true` vor Phase 3 fertig — existing `.js` hat keine Types.
- Kein `noImplicitAny: false` — strict mode beibehalten.
