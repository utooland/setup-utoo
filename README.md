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
    cache-utoo: false      # Disable utoo installation caching
    cache-store: false     # Disable npm store caching
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `utoo-version` | The version of Utoo to install (e.g. "latest", "1.0.0", "1.0.x") | `latest` |
| `registry` | The URL of the npm registry to use for installing Utoo | `https://registry.npmjs.org/` |
| `cache-utoo` | Cache utoo installation for faster subsequent runs | `true` |
| `cache-store` | Cache npm store directory (~/.cache/nm) for faster package installations | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `utoo-version` | The version of Utoo that was installed |
| `utoo-path` | The path to the Utoo executable |
| `cache-hit` | Whether the version of Utoo was cached |

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
        run: utoo install
        
      - name: Build project
        run: utoo build
```

## Features

- ✅ **Registry Support**: Configure custom npm registries
- ✅ **Dual Cache Support**: 
  - **Utoo Installation Cache**: Cache utoo binary installations for faster setup
  - **NPM Store Cache**: Cache npm packages in ~/.cache/nm for faster dependency installations
- ✅ **Cross-platform**: Works on Ubuntu, macOS, and Windows runners
- ✅ **Version Management**: Support for specific versions and ranges

## License

MIT
