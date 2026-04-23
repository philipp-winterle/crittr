# Changelog

## [3.2.0](https://github.com/philipp-winterle/crittr/compare/v3.1.2...v3.2.0) (2026-04-23)


### Features

* add removeDeclarations option to strip properties from critical… ([3be54d2](https://github.com/philipp-winterle/crittr/commit/3be54d29cf2d449fe2fae48b556cd519c72a486d))


### Bug Fixes

* rename unused variable to satisfy biome lint ([d155267](https://github.com/philipp-winterle/crittr/commit/d1552673381b25643be30b9400553eaf5ec180c4))

## [3.1.2](https://github.com/philipp-winterle/crittr/compare/v3.1.1...v3.1.2) (2026-04-23)


### Bug Fixes

* handle Windows absolute paths in isLocalFile and page navigation ([44e3efd](https://github.com/philipp-winterle/crittr/commit/44e3efd288ea3f2f9f0612956af89117a4243faf))
* handle Windows absolute paths in isLocalFile and page navigation ([3846588](https://github.com/philipp-winterle/crittr/commit/3846588cb44a984d20a523dc554ecacb7393d9e8)), closes [#61](https://github.com/philipp-winterle/crittr/issues/61)

## [3.1.0](https://github.com/philipp-winterle/crittr/compare/v3.0.0...v3.1.0) (2026-04-20)


### Features

* enhance URL evaluation with retry logic for transient errors ([1873495](https://github.com/philipp-winterle/crittr/commit/1873495bf9b2534b88356b4dbad5794a1509598b))


### Bug Fixes

* improve Puppeteer navigation reliability in CI ([02da200](https://github.com/philipp-winterle/crittr/commit/02da200a5d0c921b8364481519df0dd59ae44c30))
* streamline error handling in Crittr class ([e3efd97](https://github.com/philipp-winterle/crittr/commit/e3efd97398c2c8b9576421a987c64897552160dc))
* update GitHub Actions workflows to include id-token permissions ([e07d47f](https://github.com/philipp-winterle/crittr/commit/e07d47f9fb3a8599e1ab4430adbe983789d842be))

## [Unreleased] — 3.0.0

### ⚠ BREAKING CHANGES

- **Node.js minimum is now 20 LTS.** Node 18 reached EOL; CI matrix runs on 20.x / 22.x / 24.x.
- **Package shape:** runtime files now ship from `dist/` (previously `lib/`). The `main` / `types` / `exports` fields in `package.json` resolve to `dist/index.js` and `dist/index.d.ts`. Consumers importing from deep paths (e.g. `crittr/lib/...`) must update to the public entrypoint.
- **Public TypeScript types** are now bundled with the package — no `@types/crittr` needed.
- **Dependency cleanup:**
  - Bumped `puppeteer` to **24.x** (removes the deprecated `ignoreHTTPSErrors` option internally; see release notes).
  - Removed `css@3` (unmaintained) — replaced by a PostCSS-based adapter that preserves the reworkcss-compatible AST shape for `page.evaluate`.
  - Removed `signale` (dead dependency) and slimmed lodash usage.
- **Internal tooling migrations** (no runtime impact for consumers):
  - Test runner: Jest → **Vitest**.
  - Lint/format: ESLint + Prettier → **Biome**.

### Compatibility

- **Public API unchanged**: the default export signature `crittr(options) => Promise<{ critical, rest }>` is preserved. All existing options keys are accepted without modification.

---

## [2.0.2](https://github.com/philipp-winterle/crittr/compare/v2.0.1...v2.0.2) (2024-06-17)


### Bug Fixes

* release please need to update the package version aswell ([20506ac](https://github.com/philipp-winterle/crittr/commit/20506ac62fd54de518af137f2cebe45443615706))

## [2.0.1](https://github.com/philipp-winterle/crittr/compare/v2.0.0...v2.0.1) (2024-06-17)


### Bug Fixes

* missing "ci" in npm call ([e5e1d7d](https://github.com/philipp-winterle/crittr/commit/e5e1d7d5f0ebe81ce308bfabffdf424be8ee9212))
* missing yarn calls in actions ([9e567d6](https://github.com/philipp-winterle/crittr/commit/9e567d60ab0c69f6c5695bfdb21de2787d55c3e1))
* release please need to update the package version aswell ([20506ac](https://github.com/philipp-winterle/crittr/commit/20506ac62fd54de518af137f2cebe45443615706))
* switching token for versioning to personal access token to trigger follow up actions ([9e567d6](https://github.com/philipp-winterle/crittr/commit/9e567d60ab0c69f6c5695bfdb21de2787d55c3e1))

## [2.0.1](https://github.com/philipp-winterle/crittr/compare/v2.0.0...v2.0.1) (2024-06-17)


### Bug Fixes

* missing "ci" in npm call ([e5e1d7d](https://github.com/philipp-winterle/crittr/commit/e5e1d7d5f0ebe81ce308bfabffdf424be8ee9212))
* missing yarn calls in actions ([9e567d6](https://github.com/philipp-winterle/crittr/commit/9e567d60ab0c69f6c5695bfdb21de2787d55c3e1))
* switching token for versioning to personal access token to trigger follow up actions ([9e567d6](https://github.com/philipp-winterle/crittr/commit/9e567d60ab0c69f6c5695bfdb21de2787d55c3e1))

## [2.0.0](https://github.com/philipp-winterle/crittr/compare/1.5.3...v2.0.0) (2024-06-17)


### ⚠ BREAKING CHANGES

* changed crittr to ESM
* Minimum nodejs version is 18

### Bug Fixes

* added master branch for github action ([5f682d5](https://github.com/philipp-winterle/crittr/commit/5f682d54bbfc67bfad9c1e5762620694e54f778e))
* forgot adding release-please to scripts ([af9c307](https://github.com/philipp-winterle/crittr/commit/af9c307f46983b67808c3dc88287edb4eeb29e2c))
* tests where also transformed and fixed ([b7ec137](https://github.com/philipp-winterle/crittr/commit/b7ec1373ec4067a64242e69a8b70cccb4152eda2))
* updated github actions to fit node version ([3efd76c](https://github.com/philipp-winterle/crittr/commit/3efd76c00d394fc8b9f15030860dc427301bd7c1))


### Miscellaneous Chores

* changed crittr to ESM ([b7ec137](https://github.com/philipp-winterle/crittr/commit/b7ec1373ec4067a64242e69a8b70cccb4152eda2))
* Minimum nodejs version is 18 ([b7ec137](https://github.com/philipp-winterle/crittr/commit/b7ec1373ec4067a64242e69a8b70cccb4152eda2))
