# Strike Logger 🎯

> AI Code Review Strike Logger - Track and categorize AI-generated code errors

Transform unstructured code review feedback into structured learning data for AI coding assistants.

## 🚀 Quick Start

```bash
# Install globally
npm install -g @halonic/strike-logger

# Or use with npx
npx @halonic/strike-logger init
```

## 📖 Usage

### Initialize in your project

```bash
cd your-project
strike-logger init
```

### Log a strike from a commit

```bash
# Manual logging
strike-logger log --commit abc123 --message "Missing error handling in API call"

# Auto-detect from recent fix commits
strike-logger log --auto
```

### View statistics

```bash
strike-logger report
```

### Generate anti-pattern templates

```bash
# For ChatGPT/GPT-4
strike-logger generate --model gpt

# For Claude
strike-logger generate --model claude --output claude-antipatterns.md

# For GitHub Copilot
strike-logger generate --model copilot
```

## 🎯 Features

- **🔍 Auto-Detection**: Automatically scans git history for fix commits
- **📊 Smart Categorization**: 17+ predefined error categories with rule-based matching
- **📈 Rich Reporting**: View strikes by category, severity, and trends
- **🤖 Multi-Model Support**: Generate templates for GPT, Claude, and Copilot
- **💾 Local Storage**: All data stored locally in JSON (zero telemetry)
- **🔒 Privacy First**: No external API calls, fully offline

## 📋 Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize strike logger in current directory |
| `log` | Log a new strike from commit or manual entry |
| `report` | View strike statistics and breakdown |
| `generate` | Generate anti-pattern prompt templates |

## 🗂️ Strike Categories

The tool automatically categorizes errors into:

**Code Quality**
- Missing Error Handling
- Null Pointer Exceptions
- Race Conditions
- Memory Leaks

**Security**
- SQL Injection
- XSS Vulnerabilities
- Hardcoded Secrets
- Auth Bypass

**Architecture**
- Tight Coupling
- Missing Abstractions
- Wrong Design Patterns

**Performance**
- N+1 Query Problems
- Inefficient Algorithms

**Testing**
- Missing Tests
- Insufficient Coverage

And more...

## 💡 Example Workflow

```bash
# 1. Initialize
cd my-ai-project
strike-logger init

# 2. Auto-scan recent fixes
strike-logger log --auto

# 3. View what went wrong
strike-logger report

# 4. Generate anti-patterns for your AI
strike-logger generate --model gpt > ai-guidelines.md

# 5. Use guidelines in your AI prompts!
```

## 🎨 Sample Output

```
📊 STRIKE REPORT

Total Strikes: 23

🎯 By Severity:
  Critical: 2
  High: 8
  Medium: 10
  Low: 3

📁 By Category:
  missing_error_handling: 7
  null_pointer: 5
  missing_tests: 4
  ...
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Development mode
npm run dev
```

## 📦 Project Structure

```
strike-logger/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── parsers/            # Git diff parsing
│   ├── categorizer/        # Error categorization
│   ├── database/           # Strike storage
│   ├── templates/          # Template generation
│   └── utils/              # Utilities
├── data/
│   └── strikes.json        # Local strike database
└── templates/
    └── anti-patterns/      # Pre-built templates
```

## 🚀 Roadmap

- [ ] VS Code Extension (real-time strike detection)
- [ ] Team Dashboard (centralized analytics)
- [ ] CI/CD Integration (GitHub Actions)
- [ ] ML-based categorization
- [ ] Custom category definitions

## 📄 License

MIT © Halonic

## 🤝 Contributing

Contributions welcome! This is an open-source project from [Halonic](https://github.com/halonic).

---

**Built with ❤️ by Halonic** | [Report Issues](https://github.com/halonic/strike-logger/issues)
