#!/bin/bash

# Stop Next.js dev server script

echo "Stopping Next.js dev server..."

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ Stopped process on port 3000" || echo "No process on port 3000"

# Kill any next dev processes
pkill -f "next dev" 2>/dev/null && echo "✅ Stopped next dev processes" || echo "No next dev processes found"

# Remove lock file
rm -f .next/dev/lock && echo "✅ Removed lock file" || echo "No lock file found"

echo "Done!"

