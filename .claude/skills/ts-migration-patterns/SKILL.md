---
name: ts-migration-patterns
description: Regelwerk für JS → TS Migration im crittr-Projekt. Nutze diesen Skill, wenn eine .js-Datei zu .ts migriert wird, wenn NodeNext-Imports unsicher sind, wenn Puppeteer-page.evaluate-Code migriert wird, oder wenn zentrale Typen (CrittrOptions, CrittrResult) entworfen werden.
---

# TypeScript-Migrations-Muster für crittr

## Reihenfolge (Bottom-up)
1. `lib/types.ts` — zentrale Types definieren
2. `lib/Constants.js` → `Constants.ts`
3. `lib/helper/localFileServer.js` → `.ts`
4. `lib/classes/Rule.class.js` → `.ts`
5. `lib/classes/Ast.class.js` → `.ts`
6. `lib/classes/CssTransformator.class.js` → `.ts`
7. `lib/evaluation/extract_critical_*.js` — **SONDERFALL**, siehe unten
8. `lib/classes/Crittr.class.js` → `.ts` (Größte Fläche zuletzt)
9. `index.js` → `index.ts`

## NodeNext-Import-Regel
In `.ts`-Dateien relative Imports immer mit `.js`-Suffix:

```ts
// korrekt — auch in .ts-Source!
import { Rule } from './classes/Rule.class.js';
```

Grund: `module: "NodeNext"` resolved zur Laufzeit. TS-Source zeigt auf den kompilierten Output.

## Sonderfall: evaluation-Module
`lib/evaluation/extract_critical_with_css.js` und `extract_critical_without_css.js` werden via `page.evaluate(fnString, ...)` im Browser-Context ausgeführt. Sie dürfen **keine** TS-Runtime-Helper, keine ESM-Imports und keine nicht-browser-Globals enthalten.

**Strategie:**
- Option A (bevorzugt): Als `.js` belassen, nur JSDoc mit Types ergänzen.
- Option B: Nach `.ts` migrieren, aber `tsconfig` target ES2022 + keine Imports + keine externen Dependencies. `tsc` Output manuell inspizieren, dass kein Helper-Code entsteht.

Entscheidung: **Option A**. Zu fragile für Option B bei geringem Typ-Gewinn.

## strict: true Regeln
- Kein `any` in Applikations-Code.
- `unknown` für externe/untrusted Daten (z. B. Puppeteer-`evaluate`-Rückgaben).
- Generics wo Caller-Typ abhängig.
- `readonly` für eingehende Params wo sinnvoll.

## Zentrale Types (`lib/types.ts`)

```ts
export interface CrittrOptions {
  urls: string[];
  css?: string;
  device?: DeviceConfig;
  timeout?: number;
  pageLoadTimeout?: number;
  browser?: unknown; // Puppeteer Browser - lazy typed
  puppeteer?: PuppeteerLaunchArgs;
  keepSelectors?: string[];
  removeSelectors?: string[];
  takeScreenshots?: boolean;
  screenshotPath?: string;
  dropKeyframes?: boolean;
  // ... weitere aus Baseline-Report
}

export interface CrittrResult {
  critical: string;
  rest: string;
}

export interface DeviceConfig {
  width: number;
  height: number;
  scaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}

export interface PuppeteerLaunchArgs {
  args?: string[];
  headless?: boolean;
  ignoreHTTPSErrors?: boolean;
  executablePath?: string;
}
```

Exakte Felder: aus `_workspace/00_api_types.md`.

## Validierungs-Flow pro Datei
```bash
npx tsc --noEmit   # Typ-Check
npm test           # Verhalten unverändert
```

Beide grün → commit. Beide rot → revert.

## Typische Stolperfallen
- **Default-Exports aus CJS-Modulen**: `import merge from 'deepmerge'` kann je nach `esModuleInterop` nicht direkt klappen. Bei Problemen `import * as merge` oder named.
- **`fs-extra`**: Hat eigene Types (`@types/fs-extra` brauchts evtl.).
- **Puppeteer-Types**: `Page`, `Browser`, `LaunchOptions` aus `puppeteer` direkt importieren.
- **`object-hash`**: `@types/object-hash` als devDep.
- **Klassen-Props**: In strict mode alle class-Felder deklarieren (`private foo!: string` wenn late-init).
