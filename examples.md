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

## Cache Configuration

```yaml
name: Custom Cache Configuration

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Utoo (disable utoo caching, keep store cache)
      uses: utooland/setup-utoo@v1
      with:
        utoo-version: 'latest'
        cache-utoo: false
        cache-store: true
        
    - name: Use Utoo
      run: utoo install

## Without Any Cache

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
        cache-utoo: false
        cache-store: false
        
    - name: Use Utoo
      run: utoo install
```