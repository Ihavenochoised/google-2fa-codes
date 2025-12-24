#!/usr/bin/env bash
set -o errexit

echo "📦 Installing dependencies..."
npm install

echo "📍 List of installed dependencies:"
npm ls

echo "📍 Current IP address (add this to MongoDB access control)"
curl ifconfig.me

# New link for better visibility
echo ""

# Give the user 3 minute to copy the IP address
echo "⏳ You have 3 minute to copy the IP address above..."
sleep 175
echo "⏳ 5 seconds remaining..."
sleep 5

echo "✅️ Dependencies installed, ready to start!"