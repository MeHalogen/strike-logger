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

# Auto-detect from recent fix commits (analyzes the whole commit, all files)
strike-logger log --auto

# Interactive selection and review
strike-logger log --auto --interactive
```

### List, resolve, and delete strikes

```bash
# List strikes with their ids (filter by category/severity/status)
strike-logger list
strike-logger list --open --severity high
strike-logger list --category null_pointer -n 50

# Mark a strike resolved (accepts a full id or an unambiguous id prefix)
strike-logger resolve 23df238a

# Delete a strike (prompts for confirmation, or pass --yes)
strike-logger delete 23df238a --yes
```

### Auto-inject rules into active AI instruction files

```bash
# Auto-detect spec files (.cursorrules, .clinespec, etc.) and inject rules
strike-logger inject
```

### Enable Git Pre-Commit Safeguards

```bash
# Register the hook so staged diff changes are scanned automatically before git commits
strike-logger hook --register

# To disable/unregister:
strike-logger hook --unregister
```

### View statistics

```bash
# Terminal summary
strike-logger report

# Visual HTML dashboard (severity/category bars, monthly trend, recent strikes)
strike-logger report --html report.html

# Export raw data as CSV
strike-logger report --csv strikes.csv
```

### CI/CD integration (GitHub Actions)

```bash
# Scaffold a workflow that fails PRs reintroducing known anti-patterns
strike-logger ci --init

# Run the check locally against a diff range (this is what CI runs)
strike-logger ci --check --base origin/main --head HEAD
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

- **🔍 Auto-Detection**: Automatically scans git history for fix commits (whole-commit, multi-file analysis)
- **✍️ Interactive Review**: Review commits interactively to toggle strikes, verify diffs, and write custom comments
- **📊 Smart Categorization**: 17 predefined error categories with rule-based matching and confidence scoring
- **🗂️ Strike Management**: `list`, `resolve`, and `delete` strikes by id or unambiguous prefix
- **📈 Rich Reporting**: Terminal summary, standalone **HTML dashboard**, and CSV export with monthly trends
- **⚙️ Custom Categories**: Define your own rules, labels, and severity overrides via a config file
- **🤖 CI/CD Integration**: Scaffold a GitHub Actions workflow that fails PRs reintroducing known anti-patterns
- **💉 Spec Injection**: Auto-inject anti-pattern rules directly into `.cursorrules`, `.clinespec`, and other active AI configs
- **🛡️ Hook Safeguard**: Git pre-commit hook scanning to block new commits containing known recurring bugs
- **💾 Local Storage**: All data stored locally in JSON with atomic writes and schema migration (zero telemetry)
- **🔒 Privacy First**: No external API calls, fully offline

## 📋 Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize strike logger in current directory |
| `log` | Log a new strike from commit or manual entry |
| `list` | List logged strikes with their ids (filterable) |
| `resolve` | Mark a strike resolved by id or unambiguous prefix |
| `delete` | Delete a strike by id or unambiguous prefix |
| `report` | View strike statistics; export `--html` / `--csv` |
| `generate` | Generate anti-pattern prompt templates |
| `inject` | Auto-inject generated anti-pattern rules into active spec files |
| `hook` | Manage git pre-commit hook safeguard |
| `ci` | Scaffold a CI workflow (`--init`) or check a diff range (`--check`) |

## ⚙️ Custom Configuration

Drop a `strike-logger.config.json` (or `.strikerc.json`) in your project root to extend
categorization without touching source. A bad config is ignored, never fatal.

```json
{
  "customRules": [
    {
      "category": "flaky_test",
      "keywords": ["flaky", "sleep"],
      "patterns": ["setTimeout.*test", "\\bflaky\\b"],
      "weight": 1.2
    }
  ],
  "categoryLabels": { "flaky_test": "Flaky Tests" },
  "severityOverrides": { "flaky_test": "high" }
}
```

- **`customRules`** — extra rules merged after the built-ins (`patterns` are case-insensitive regex strings).
- **`categoryLabels`** — human-readable names shown in reports.
- **`severityOverrides`** — force a severity for a category, taking precedence over the heuristics.

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
│   ├── parsers/            # Git diff parsing (multi-file, diff ranges)
│   ├── categorizer/        # Error categorization + confidence scoring
│   ├── config/             # User config loader & custom-rule compilation
│   ├── database/           # Strike storage, migration, atomic writes
│   ├── templates/          # Template generation and auto-injector
│   ├── reporting/          # HTML dashboard generation
│   ├── ci/                 # GitHub Actions workflow + diff-range check
│   ├── interactive/        # Interactive CLI prompting
│   └── hooks/              # Git hook + shared anti-pattern scanner
├── data/
│   └── strikes.json        # Local strike database
└── tests/                  # Vitest unit test suites
```

## 🚀 Roadmap

- [ ] VS Code Extension (real-time strike detection)
- [ ] Team Dashboard (centralized analytics)
- [x] Git Hook Pre-Commit Integration
- [x] Auto-Spec / Prompts rules injection
- [x] CI/CD Integration (GitHub Actions)
- [x] Custom category definitions
- [x] HTML/CSV reporting with trends
- [x] Strike management (list / resolve / delete)
- [ ] ML-based categorization

## 📄 License

MIT © Halonic

## 🤝 Contributing

Contributions welcome! This is an open-source project from [Halonic](https://github.com/halonic).

---

**Built with ❤️ by Halonic** | [Report Issues](https://github.com/halonic/strike-logger/issues)
