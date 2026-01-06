# Setup Instructions

## Node.js Version Requirement

This project requires **Node.js >= 20.9.0** (Next.js 16 requirement).

## Quick Setup

### Option 1: Using nvm (Recommended)

nvm has been installed for you. To use it:

1. **Open a new terminal** (or reload your current one):
   ```bash
   source ~/.bash_profile  # or source ~/.zshrc if using zsh
   ```

2. **Navigate to the project and use Node 20**:
   ```bash
   cd modern-app
   nvm use 20
   ```

3. **Verify Node version**:
   ```bash
   node --version  # Should show v20.x.x
   ```

4. **Start the dev server**:
   ```bash
   npm run dev
   ```

### Option 2: Manual Node.js Installation

If you prefer not to use nvm, download and install Node.js 20+ from [nodejs.org](https://nodejs.org/).

## Automatic Node Version Switching

The project includes a `.nvmrc` file. If you have nvm installed and configured, you can simply run:

```bash
cd modern-app
nvm use  # Automatically uses Node 20 as specified in .nvmrc
npm run dev
```

## Troubleshooting

### "nvm: command not found"

If you get this error, reload your shell profile:
```bash
source ~/.bash_profile  # for bash
# or
source ~/.zshrc  # for zsh
```

Or open a new terminal window.

### "Node.js version is too old"

Make sure you're using Node 20+:
```bash
node --version
```

If it shows v16.x or lower, run:
```bash
nvm use 20
```

### Persistent Node Version

To set Node 20 as default:
```bash
nvm alias default 20
```

