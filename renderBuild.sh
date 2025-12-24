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

# Skip the above if $skip_ip_wait is set to true
if [ "$skip_ip_wait" = "true" ]; then
    echo "⏩ Skipping wait for IP address copy."
    echo ""
else
    # Give the user 3 minute to copy the IP address
    echo "⏳ You have 3 minute to copy the IP address above..."
    sleep 175
    echo "⏳ 5 seconds remaining..."
    sleep 5
    echo "✅️ Done waiting for IP address copy."
    echo ""
fi

echo "✅️ Dependencies installed, ready to start!"