---
name: modernize-crittr
description: Orchestriert die vollständige Modernisierung der crittr-Library — Dependency-Upgrades, Migration von JavaScript zu TypeScript, Wechsel von ESLint+Prettier zu Biome, Jest zu Vitest, Node-CI-Update. Nutze diesen Skill immer, wenn der User "modernisieren", "updaten", "TS-Migration", "Biome-Umstieg", "Vitest-Umstieg", "Phase X starten", "weiter mit Modernisierung", "Rework crittr" oder ähnliche Formulierungen im crittr-Kontext verwendet. Koordiniert ein Team aus baseline-auditor, deps-upgrader, tooling-migrator, ts-migrator, test-modernizer, release-engineer, reviewer.
---

# Modernize crittr — Orchestrator Skill

## Ziel
crittr (ESM-JS, Node ≥18, Jest, ESLint/Prettier, Puppeteer 22) → (ESM-TS, Node ≥20, Vitest, Biome, Puppeteer 24, saubere Package-Exports) ohne API-Breaks und mit grüner Testsuite auf jedem Zwischenstand.

## Phasen-Übersicht

| Phase | Agent | Input | Output | Abbruch-Kriterium |
|-------|-------|-------|--------|-------------------|
| 0 Baseline | baseline-auditor | Repo-Stand | `00_baseline_report.md`, `00_api_types.md` | Tests nicht grün → STOP, User fragen |
| 1 Minor-Deps | deps-upgrader | Phase 0 | `01_minor_upgrade_log.md` | Test-Rot → einzelne Dep pinnen |
| 2 Biome+TS-Setup | tooling-migrator | Phase 0 | `biome.json`, `tsconfig.json`, `02_tooling_report.md` | biome check / tsc fail → fix |
| 3 TS-Migration | ts-migrator | Phase 2 | `lib/**/*.ts`, `03_ts_migration_log.md` | Test-Rot → Revert, Datei überspringen |
| 4 Vitest | test-modernizer | Phase 3 | `vitest.config.ts`, `test/**/*.test.ts` | Suite rot → pause, Puppeteer-Fixture prüfen |
| 5 Major-Deps | deps-upgrader | Phase 3+4 | `05_major_upgrade_log.md` | Per-Major Rollback möglich |
| 6 Build+Package | release-engineer | Phase 3+4+5 | Build-Config | `npm pack` output check |
| 7 CI modernisieren | release-engineer | Phase 6 | `.github/workflows/node.js.yml`, `.nvmrc` | GHA syntax check |
| 8 Final Review + Release | reviewer + release-engineer | alle | Release 3.0.0 | Kein CRITICAL offen |

## Ausführungs-Modus
**Hybrid**:
- Phase 0, 2, 3, 6, 7 → einzelner Agent (serielle Pipeline).
- Phase 1, 5 → deps-upgrader + reviewer parallel (Generate-Verify).
- Phase 4 → test-modernizer + ts-migrator kooperativ (bei TS-Fehlern in Tests).
- Phase 8 → Team-Modus: reviewer + release-engineer + ein Vertreter der anderen.

## Data-Flow
Alle Artefakte landen in `_workspace/{phase}_*.md`. Jeder Agent liest Vorgänger-Outputs vor Start. Letzter Schritt pro Phase: Reviewer approved in `_workspace/review_phase_{N}.md`.

## Kontext-Erkennung (Phase -1)
Bei jedem Aufruf prüfen:
1. Existiert `_workspace/progress.md`? → **Fortsetzung**, letzte abgeschlossene Phase auslesen.
2. Existieren `_workspace/00_*.md` aber kein `progress.md`? → Reparatur-Modus, `progress.md` rekonstruieren.
3. Nichts vorhanden → **Initial-Lauf** ab Phase 0.

Benutzer-Formulierungen erkennen:
- "Phase 3 erneut" → nur Phase 3 re-run, vorige Outputs nach `_workspace_prev/` sichern.
- "weiter" / "continue" → nächste pending Phase starten.
- "Release" → direkt Phase 8.

## Error-Handling
- **1 Retry** pro fehlgeschlagenem Agent-Call.
- Danach: Pause, User-Rückfrage mit Diagnose aus Agent-Log.
- Test-Rot nie ignorieren — entweder Fix oder Revert.

## Test-Szenarien

### Normal-Flow
1. User: "Starte Modernisierung"
2. Orchestrator → Phase 0 (baseline-auditor)
3. Review grün → Phase 1 (deps-upgrader minor)
4. ... sequenziell bis Phase 8
5. Release-Tag 3.0.0 erstellt.

### Error-Flow
1. Phase 5: Puppeteer 24 Upgrade → `screenshot.test.ts` rot.
2. deps-upgrader revertet, SendMessage an reviewer.
3. reviewer analysiert Diff, empfiehlt API-Call-Anpassung.
4. ts-migrator + deps-upgrader kooperativ, zweiter Versuch.
5. Tests grün → Phase 5 fortsetzen.

## Referenzen
- `.claude/skills/ts-migration-patterns/SKILL.md` — TS-File-by-File-Pattern
- `.claude/skills/biome-setup/SKILL.md` — Biome-Config-Mapping
- `.claude/skills/vitest-migration/SKILL.md` — Vitest-Umstieg
