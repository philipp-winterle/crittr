---
name: vitest-migration
description: Migration von Jest (mit --experimental-vm-modules Flag) zu Vitest für crittr. Nutze diesen Skill bei der Phase-4-Umstellung, beim Mapping von jest.config zu vitest.config, beim Überführen von globalSetup/globalTeardown mit Puppeteer-Fixtures, oder beim Mass-Replace von jest.fn/spyOn auf vi.fn/vi.spyOn in Test-Suites.
---

# Vitest-Migration für crittr

## Warum Vitest
- Native ESM — kein `--experimental-vm-modules` mehr.
- Native TS ohne ts-jest.
- Jest-kompatible API — minimale Test-Code-Änderungen.
- Schnellere Watch-Mode-Experience.

## Dependencies
**Install**:
```bash
npm install -D vitest
```

**Remove**:
```bash
npm uninstall jest @types/jest cross-env
```

## vitest.config.ts (Ziel)

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        environment: 'node',
        include: ['test/tests/**/*.test.{js,ts}'],
        globalSetup: './test/setup.ts',
        bail: 1,
        reporters: ['verbose'],
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
```

**Globaler Teardown**: Vitest unterstützt `globalSetup`-Return-Funktion als Teardown. Beispiel:

```ts
// test/setup.ts
export default async function globalSetup() {
    // ... start server / browser
    return async () => {
        // teardown logic (was jest globalTeardown)
    };
}
```

Alternativ: Separate `globalTeardown`-Option in Vitest-Config (Versions-abhängig).

## Test-File-Änderungen

### Vorher (Jest)
```js
// test/tests/basic.test.js
describe('basic', () => {
    it('extracts critical css', async () => {
        const result = await run();
        expect(result.critical).toBeDefined();
    });
});
```

### Nachher (Vitest)
```ts
// test/tests/basic.test.ts
import { describe, it, expect } from 'vitest';

describe('basic', () => {
    it('extracts critical css', async () => {
        const result = await run();
        expect(result.critical).toBeDefined();
    });
});
```

Bei Vitest mit `globals: true` funktioniert Jest-like auch ohne Imports — wir halten `globals: false` für Sauberkeit.

## Mapping-Tabelle
| Jest | Vitest |
|------|--------|
| `jest.fn()` | `vi.fn()` |
| `jest.spyOn()` | `vi.spyOn()` |
| `jest.mock()` | `vi.mock()` |
| `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| `beforeAll/afterAll` | identisch |
| `test.only / test.skip` | identisch |
| `jest.setTimeout(ms)` im File | `test.setTimeout(ms)` oder Config |

## package.json Scripts
```json
{
  "scripts": {
    "test": "vitest run --reporter=verbose",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

## Puppeteer-Fixture-Risiken
- **Globale Browser-Instanz** in `setup.js`: Sicherstellen, dass Singleton zwischen Tests bleibt.
- **Parallele Test-Files**: Vitest läuft Files parallel. `test.concurrent` nicht zusätzlich nutzen, wenn Fixture sequenziell erwartet wird.
- **`pool: 'forks'`** kann helfen, wenn native Addons (puppeteer) Probleme machen.

Bei Puppeteer-Problemen:
```ts
test: {
    pool: 'forks',
    poolOptions: {
        forks: { singleFork: true }  // seriell, sicherer bei single Browser-Instanz
    }
}
```

## Migrations-Schritte (pro Suite)
1. `.js` → `.test.ts` umbenennen (oder erstmal `.test.js`, später in Phase 3).
2. Import-Statement `from 'vitest'` hinzufügen.
3. `jest.*` → `vi.*` ersetzen.
4. `npx vitest run test/tests/<file>` → grün.
5. Nächste Suite.

## Validierung
- Alle 6 Suites müssen grün sein: `basic`, `basic_nocss`, `mq`, `mq_nocss`, `screenshot`, `vendor_prefix`.
- Kein Flag mehr in `test`-Script (`--experimental-vm-modules` weg).
- `npm test` identisches Verhalten wie vorher.
