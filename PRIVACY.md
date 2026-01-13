# Privacy Policy for PromptLint

**Last Updated**: January 13, 2026

## Overview

PromptLint is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights.

## Data Collection

### Local Data Only
- **Prompt Analysis**: All prompt analysis happens locally on your Mac
- **History Storage**: Prompt history is stored in `~/.promptlint/history.db` on your device
- **Settings**: App settings are stored locally using electron-store

### No Cloud Services
- We do not collect, transmit, or store any user data on remote servers
- No analytics, telemetry, or crash reporting
- No user tracking of any kind

### Optional AI Features
If you enable AI-powered improvements:
- Your prompts are sent to Anthropic's Claude API
- Subject to [Anthropic's Privacy Policy](https://www.anthropic.com/privacy)
- You control whether this feature is enabled
- Your API key is stored locally and encrypted

## Permissions

### Required Permissions
- **Accessibility**: To capture text from other applications (when enabled)
- **Network**: To communicate with Claude API (only if AI features enabled)

### Not Required
- No camera access
- No microphone access
- No contacts access
- No location services

## Data Storage

### Local Storage
- SQLite database: `~/.promptlint/history.db`
- Settings: `~/Library/Application Support/PromptLint/config.json`
- You can delete this data at any time

### User Control
- Export your data anytime
- Delete your history anytime
- Full control over what gets analyzed

## Third-Party Services

### Anthropic Claude API (Optional)
- Only used if you enable AI improvements
- You provide your own API key
- Subject to Anthropic's terms and privacy policy

## Children's Privacy

PromptLint is not directed to children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this policy. Changes will be posted to this page with an updated "Last Updated" date.

## Contact

Questions? Open an issue on GitHub:
https://github.com/philokalos/prompt-evolution/issues

---

**Summary**: PromptLint processes all data locally. No cloud services. No tracking. You're in control.
