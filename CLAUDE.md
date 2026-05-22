# crittr — Projekt-Kontext für Claude

crittr ist eine Critical-CSS-Extraction-Library (Node.js, ESM). Aktuell im Übergang von JavaScript zu TypeScript und von ESLint+Prettier+Jest zu Biome+Vitest.

## Hinweis
- ESM-only (`"type": "module"`).
- Bis Phase 3 abgeschlossen: Source lebt in `lib/` als `.js` und zunehmend `.ts`. Browser-Context-Module (`lib/evaluation/extract_critical_*.js`) bleiben bewusst JS.
- API-Signatur (`index.js` default export, `CrittrOptions`, Rückgabe `{ critical, rest }`) darf **nicht** brechen.

## Hub und Harness: Modernisierung

**Ziel:** crittr von JS/ESLint/Prettier/Jest auf TS/Biome/Vitest migrieren, Dependencies updaten, Tests und API stabil halten.

**Trigger:** Bei Anfragen wie "weiter mit Modernisierung", "Phase X starten", "TS-Migration", "Biome umstellen", "Vitest", "Update dependencies", "crittr modernisieren" → `modernize-crittr` Skill aktivieren. Einfache Fragen direkt beantworten.

**Team:** `orchestrator-lead` dirigiert. Sub-Agents: `baseline-auditor`, `deps-upgrader`, `tooling-migrator`, `ts-migrator`, `test-modernizer`, `release-engineer`, `reviewer`.

**Arbeits-Workspace:** `_workspace/` — Baseline-Reports, Phase-Logs, Review-Notes. Nicht committen, siehe `.gitignore`.

**Änderungs-Historie:**
| Datum | Änderung | Ziel | Grund |
|-------|----------|------|-------|
| 2026-04-17 | Initial-Harness | Agents + Skills + CLAUDE.md | Start Modernisierung 2.0.2 → 3.0.0 |
