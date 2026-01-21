# Privacy Policy - PromptLint

**Last Updated**: January 21, 2026

## Overview

PromptLint is a desktop application designed to analyze and improve AI prompts locally on your device. We are committed to protecting your privacy and ensuring transparency about how your data is handled.

## Data Collection

### What We Collect

**Local Storage Only**:
- Your prompt analysis history (stored locally in `~/.promptlint/history.db`)
- Application settings and preferences
- Project-specific configurations

### What We Do NOT Collect

- No personal identification information
- No usage analytics or telemetry
- No crash reports sent automatically
- No data transmitted to our servers

## Third-Party Services

### AI Provider APIs (Optional)

If you choose to enable AI-powered prompt rewriting, your prompts may be sent to:

| Provider | Purpose | Data Sent |
|----------|---------|-----------|
| Anthropic (Claude) | AI prompt improvement | Prompt text only |
| OpenAI | AI prompt improvement | Prompt text only |
| Google (Gemini) | AI prompt improvement | Prompt text only |

**Important**:
- AI features are **optional** and disabled by default
- API keys are stored locally on your device
- You control which provider to use
- Prompts are sent only when you explicitly request AI improvement

Refer to each provider's privacy policy:
- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [OpenAI Privacy Policy](https://openai.com/privacy)
- [Google AI Privacy Policy](https://ai.google/privacy)

## Data Storage

All data is stored locally on your macOS device:

| Data | Location | Purpose |
|------|----------|---------|
| Analysis History | `~/.promptlint/history.db` | Progress tracking |
| Settings | `~/Library/Application Support/PromptLint/` | User preferences |
| API Keys | Local encrypted storage | AI provider authentication |

## Permissions

PromptLint requests the following macOS permissions:

| Permission | Purpose |
|------------|---------|
| Accessibility | Read selected text from other applications |
| Clipboard Access | Analyze copied prompts |
| File System | Store analysis history and settings |

## Data Retention

- **Analysis History**: Stored indefinitely until you delete it
- **Settings**: Persisted until app uninstallation
- **API Keys**: Stored until you remove them

### Deleting Your Data

To remove all PromptLint data:

```bash
# Remove analysis history
rm -rf ~/.promptlint

# Remove application settings
rm -rf ~/Library/Application\ Support/PromptLint

# Remove preferences
rm ~/Library/Preferences/com.mtmd.promptlint.plist
```

## Children's Privacy

PromptLint is not intended for users under 13 years of age.

## Changes to This Policy

We may update this privacy policy periodically. Changes will be reflected in the "Last Updated" date above.

## Contact

For privacy-related questions:
- GitHub Issues: https://github.com/promptlint/promptlint/issues

## Summary

- **Your data stays on your device**
- **No tracking or analytics**
- **AI features are optional and transparent**
- **You have full control over your data**
