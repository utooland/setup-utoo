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

### Disable Cache

```yaml
- uses: utooland/setup-utoo@v1
  with:
    utoo-version: 'latest'
    no-cache: true
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `utoo-version` | The version of Utoo to install (e.g. "latest", "1.0.0", "1.0.x") | `latest` |
| `registry` | The URL of the npm registry to use for installing Utoo | `https://registry.npmjs.org/` |
| `no-cache` | Disable caching of utoo installation | `false` |

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
- ✅ **Cache Support**: Automatic caching for faster builds  
- ✅ **Cross-platform**: Works on Ubuntu, macOS, and Windows runners
- ✅ **Version Management**: Support for specific versions and ranges

## License

MIT
