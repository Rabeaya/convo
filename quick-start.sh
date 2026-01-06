#!/bin/bash

# Quick start script for modern-app
# This script loads nvm and starts the dev server

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node 20
nvm use 20

# Start dev server
npm run dev

