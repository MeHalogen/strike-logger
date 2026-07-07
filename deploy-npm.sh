#!/bin/bash
# Halogen Labs - Strike Logger npm Publication Script
# Run this script after: npm login

set -e

echo "🚀 Halogen Labs - npm Publication"
echo "=================================="
echo ""

# Check npm authentication
if npm whoami &> /dev/null; then
    NPM_USER=$(npm whoami)
    echo "✅ Logged in as: $NPM_USER"
    echo ""
    
    cd /Users/mehalsrivastava/GitHub/Idea1/strike-logger
    
    # Verify package
    echo "📦 Package details:"
    echo "  Name: @halonic/strike-logger"
    echo "  Version: 0.3.0"
    echo "  Size: 34.1 kB"
    echo ""
    
    # Build
    echo "🔨 Building package..."
    npm run build
    echo "✅ Build successful"
    echo ""
    
    # Publish
    echo "📤 Publishing to npm..."
    npm publish --access public
    
    echo ""
    echo "🎉 SUCCESS! Package published!"
    echo ""
    echo "📦 View at: https://www.npmjs.com/package/@halonic/strike-logger"
    echo ""
    echo "Install with:"
    echo "  npm install -g @halonic/strike-logger"
    echo ""
    echo "Or use directly:"
    echo "  npx @halonic/strike-logger init"
    
else
    echo "❌ Not logged in to npm"
    echo ""
    echo "Please run first:"
    echo "  npm login"
    echo ""
    echo "If you don't have an npm account:"
    echo "  npm adduser"
    echo ""
    echo "Then run this script again:"
    echo "  ./deploy-npm.sh"
fi
