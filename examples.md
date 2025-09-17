# Example Workflows

## Basic Usage

```yaml
name: Build with Utoo

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Utoo
      uses: utooland/setup-utoo@v1
      with:
        utoo-version: 'latest'
    
    - name: Install dependencies
      run: utoo install
      
    - name: Build project
      run: utoo build
```

## With Custom Registry

```yaml
name: Build with Custom Registry

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Utoo
      uses: utooland/setup-utoo@v1
      with:
        utoo-version: '1.0.0'
        registry: 'https://npm.pkg.github.com'
        
    - name: Run commands
      run: |
        utoo --version
        utoo install
```

## Cross-Platform Matrix

```yaml
name: Cross-Platform Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        utoo-version: ['latest', '0.0.0-alpha.53']
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Utoo
      uses: utooland/setup-utoo@v1
      with:
        utoo-version: ${{ matrix.utoo-version }}
        
    - name: Test installation
      run: |
        utoo --version
        ut --help
```

## Without Cache

```yaml
name: Build without Cache

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Utoo (no cache)
      uses: utooland/setup-utoo@v1
      with:
        utoo-version: 'latest'
        no-cache: true
        
    - name: Use Utoo
      run: utoo install
```