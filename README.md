# Cachearoo

[![Build](https://github.com/stinkydev/cachearoo/actions/workflows/build_and_test.yml/badge.svg)](https://github.com/stinkydev/cachearoo/actions/workflows/build_and_test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-grade key/value store with a real-time WebSocket event bus. Clients can read and write data over HTTP or WebSocket and subscribe to changes as they happen.

## Client library

A TypeScript client for Node.js and the browser is available on npm:

```bash
npm install @stinkycomputing/cachearoo
```

See [@stinkycomputing/cachearoo](https://www.npmjs.com/package/@stinkycomputing/cachearoo).

## Development

```bash
npm install                # install backend dependencies
npm install --prefix _admin  # install frontend dependencies
npm run build              # compile backend and frontend
npm test                   # run tests
npm run dev                # run the server in dev mode
npm start --prefix _admin  # admin UI with hot reload on 127.0.0.1:8080 (proxies API to 4300)
```

## Packaging

```bash
npm run package-win        # build build/win/cachearoo.exe
npm run package-deb        # build a Debian package
```

Windows installer (Inno Setup):

```bash
iscc.exe setup\inno-setup\Cachearoo.iss /F"$OutputName" /DVersion=$FileVer
```

## License

Cachearoo is licensed under the [MIT License](LICENSE). Copyright © 2020-2026 Stinky Computing AB.

Bundled third-party software and its licenses are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), regenerated with `node scripts/gen-third-party-notices.js`.
