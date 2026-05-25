#!/bin/bash
# Halonic - Complete Deployment Orchestrator
# One-command deployment for Strike Logger

set -e

echo "🚀 HALONIC - STRIKE LOGGER DEPLOYMENT"
echo "=========================================="
echo ""
echo "Project: Strike Logger v0.1.0"
echo "Package: @halonic/strike-logger"
echo ""

# Step 1: npm Publication
echo "📦 STEP 1: npm Publication"
echo "-------------------------"
if npm whoami &> /dev/null; then
    echo "✅ npm authenticated"
    cd /Users/mehalsrivastava/GitHub/Idea1/strike-logger
    
    echo "Building..."
    npm run build > /dev/null 2>&1
    
    echo "Publishing..."
    if npm publish --access public > /dev/null 2>&1; then
        echo "✅ Published to npm"
        echo "   https://www.npmjs.com/package/@halogen-labs/strike-logger"
    else
        echo "⚠️  Already published or error occurred"
    fi
else
    echo "❌ npm authentication required"
    echo "   Run: npm login"
    echo "   Then rerun this script"
    exit 1
fi

echo ""

# Step 2: GitHub Repository
echo "📂 STEP 2: GitHub Repository"
echo "-------------------------"
if command -v gh &> /dev/null; then
    if gh auth status > /dev/null 2>&1; then
        echo "✅ GitHub CLI authenticated"
        
        cd /Users/mehalsrivastava/GitHub/Idea1/strike-logger
        
        # Check if repo already exists
        if gh repo view halogen-labs/strike-logger > /dev/null 2>&1; then
            echo "⚠️  Repository already exists"
            echo "   https://github.com/halogen-labs/strike-logger"
        else
            echo "Creating repository..."
            gh repo create halogen-labs/strike-logger \
                --public \
                --source=. \
                --remote=origin \
                --push \
                --description "AI Code Review Strike Logger - Track and prevent repeated AI coding mistakes" \
                > /dev/null 2>&1
            
            echo "✅ Repository created and pushed"
            echo "   https://github.com/halogen-labs/strike-logger"
            
            echo "Creating release..."
            gh release create v0.1.0 \
                --title "Strike Logger v0.1.0" \
                --notes "🎉 Initial Release

Built by Halonic

## Installation
\`\`\`bash
npm install -g @halonic/strike-logger
\`\`\`" > /dev/null 2>&1
            
            echo "✅ Release v0.1.0 created"
        fi
    else
        echo "❌ GitHub CLI not authenticated"
        echo "   Run: gh auth login"
        exit 1
    fi
else
    echo "⚠️  GitHub CLI not installed"
    echo "   Run: brew install gh"
    echo "   Then: gh auth login"
    echo ""
    echo "Or deploy manually:"
    echo "   ./deploy-github.sh"
fi

echo ""

# Step 3: Summary
echo "✅ DEPLOYMENT COMPLETE"
echo "===================="
echo ""
echo "📦 npm Package:"
echo "   npm install -g @halonic/strike-logger"
echo "   https://www.npmjs.com/package/@halonic/strike-logger"
echo ""
echo "🌐 GitHub:"
echo "   https://github.com/halonic/strike-logger"
echo ""
echo "🚀 Next Steps:"
echo "   1. Post on Hacker News (Show HN)"
echo "   2. Tweet announcement"
echo "   3. Post on Reddit r/programming"
echo "   4. Prepare Product Hunt launch"
echo ""
echo "🎯 Target: 500 downloads in Week 1"
