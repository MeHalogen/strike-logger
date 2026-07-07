#!/bin/bash
# Halonic - Strike Logger GitHub Deployment Script
# Run this script to deploy to GitHub

set -e

echo "🚀 Halonic - GitHub Deployment"
echo "===================================="
echo ""

# Check if gh CLI is installed
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI detected"
    echo ""
    echo "Creating repository and pushing code..."
    
    cd /Users/mehalsrivastava/GitHub/Idea1/strike-logger
    
    # Create repo and push in one command
    gh repo create MeHalogen/strike-logger \
        --public \
        --source=. \
        --remote=origin \
        --push \
        --description "AI Code Review Strike Logger - Track and prevent repeated AI coding mistakes"
    
    echo ""
    echo "✅ Repository created and code pushed!"
    echo "🌐 View at: https://github.com/MeHalogen/strike-logger"
    
    # Create release
    echo ""
    echo "Creating v0.3.0 release..."
    gh release create v0.3.0 \
        --title "Strike Logger v0.3.0" \
        --notes "🎉 Release by Halonic
 
 ## Features
 - ✅ Full CLI implementation (init, log, report, generate)
 - ✅ 17 predefined error categories
 - ✅ Auto-detection from git history
 - ✅ Multi-model support (GPT, Claude, Copilot)
 - ✅ Zero external dependencies
 - ✅ QA certified: 10/10 tests passed
 
 ## Installation
 \`\`\`bash
 npm install -g @halonic/strike-logger
 \`\`\`
 
 ## Quick Start
 \`\`\`bash
 strike-logger init
 strike-logger log --auto
 strike-logger report
 strike-logger generate --model gpt
 \`\`\`
 
 Built with ❤️ by Halonic"
    
    echo "✅ Release v0.3.0 created!"
    
else
    echo "⚠️  GitHub CLI not found"
    echo ""
    echo "Option 1: Install GitHub CLI (recommended)"
    echo "  brew install gh"
    echo "  gh auth login"
    echo "  ./deploy-github.sh"
    echo ""
    echo "Option 2: Manual setup"
    echo "  1. Go to https://github.com/organizations/plan"
    echo "  2. Create organization: MeHalogen (free)"
    echo "  3. Go to https://github.com/new"
    echo "  4. Owner: MeHalogen"
    echo "  5. Repository: strike-logger"
    echo "  6. Public"
    echo "  7. Click 'Create repository'"
    echo ""
    echo "  Then run:"
    echo "  cd /Users/mehalsrivastava/GitHub/Idea1/strike-logger"
    echo "  git remote add origin git@github.com:MeHalogen/strike-logger.git"
    echo "  git push -u origin main"
    echo "  git tag v0.3.0"
    echo "  git push origin v0.3.0"
fi
