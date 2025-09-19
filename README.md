# setup-utoo

GitHub Action for setting up [Utoo](https://github.com/utooland/utoo) - a unified frontend toolchain.

## Usage

### Basic Setup

```yaml
- uses: utooland/setup-utoo@v1
  with:
    utoo-version: 'latest'
```

### Custom Registry

```yaml
- uses: utooland/setup-utoo@v1
  with:
    utoo-version: '1.0.0'
    registry: 'https://registry.npmjs.org/'
```

### Cache Configuration

```yaml
- uses: utooland/setup-utoo@v1
  with:
    utoo-version: 'latest'
    cache-store: true # enable ~/.cache/nm tgz cache
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `utoo-version` | The version of Utoo to install (e.g. "latest", "1.0.0", "1.0.x") | `latest` |
| `registry` | The URL of the npm registry to use for installing Utoo | `https://registry.npmjs.org/` |
| `cache-store` | Cache npm store directory (~/.cache/nm) for faster package installations | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `utoo-version` | The version of Utoo that was installed |

## Example Workflow

```yaml
name: Build with Utoo

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: utooland/setup-utoo@v1
        with:
          utoo-version: 'latest'

      - name: Install dependencies
        run: utoo

      - name: Build project
        run: utoo build
```

## Features

- ✅ **Registry Support**: Configure custom npm registries
- ✅ **Dual Cache Support**:
- ✅ **NPM Store Cache**: Cache npm packages in ~/.cache/nm for
- ✅ **Cross-platform**: Works on Ubuntu, macOS
- ✅ **Version Management**: Support for specific versions and ranges

## License

MIT
