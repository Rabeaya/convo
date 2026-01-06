# Quick Start Guide

## Problem: "nvm: command not found"

This happens because nvm needs to be loaded in your current shell session. Here are the solutions:

## Solution 1: Load nvm in current terminal (Quick Fix)

Run these commands in your current terminal:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
npm run dev
```

## Solution 2: Use the quick-start script

I've created a script that does this automatically:

```bash
cd modern-app
./quick-start.sh
```

## Solution 3: Open a new terminal

After installing nvm, you need to either:
1. **Close and reopen your terminal**, OR
2. **Reload your shell profile**:
   ```bash
   source ~/.bash_profile
   # or if using zsh:
   source ~/.zshrc
   ```

Then run:
```bash
cd modern-app
nvm use 20
npm run dev
```

## Solution 4: Add to your current session manually

Copy and paste this into your terminal:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
nvm use 20
cd modern-app
npm run dev
```

## Verify it's working

After loading nvm, verify Node version:
```bash
node --version  # Should show v20.19.6
```

## Permanent Fix

To make nvm available in all new terminals, make sure your `~/.bash_profile` (or `~/.zshrc`) includes:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
```

This has already been added to your profile files. Just open a new terminal or reload your profile.

