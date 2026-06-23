#!/bin/bash
echo ""
echo " ============================================"
echo "  Distillery Capital Proposal Generator"
echo " ============================================"
echo ""

# Check Node is installed
if ! command -v node &> /dev/null; then
    echo " ERROR: Node.js is not installed."
    echo " Download from: https://nodejs.org  (choose the LTS version)"
    exit 1
fi

# Install dependencies if missing
if [ ! -d "node_modules" ]; then
    echo " Installing dependencies for the first time..."
    npm install
    echo ""
fi

# Open browser then start server
echo " Starting server..."
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || true
node server.js
