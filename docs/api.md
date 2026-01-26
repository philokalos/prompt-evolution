# API Documentation

## Overview

Prompt Evolution Dashboard provides a REST API for accessing conversation analytics, insights, and synchronization features.

## Base URL

- **Development**: `http://localhost:3001/api`
- **Production**: Deploy your own instance

## Authentication

Currently no authentication required. Intended for local/private use.

---

## Endpoints

### Health Check

#### `GET /api/health`

Check if the server is running.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-26T12:00:00.000Z"
}
```

---

### Statistics

#### `GET /api/stats`

Get overall database statistics.

**Response**:
```json
{
  "conversations": 150,
  "turns": 1200,
  "userPrompts": 450,
  "avgEffectiveness": 0.72,
  "avgQuality": 0.68,
  "projects": 8,
  "lastSync": "2025-01-26T10:00:00.000Z",
  "lastAnalysis": "2025-01-26T10:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| conversations | number | Total number of parsed conversations |
| turns | number | Total number of conversation turns |
| userPrompts | number | Total user prompts analyzed |
| avgEffectiveness | number | Average effectiveness score (0-1) |
| avgQuality | number | Average quality score (0-1) |
| projects | number | Number of distinct projects |
| lastSync | string | ISO timestamp of last data sync |
| lastAnalysis | string | ISO timestamp of last analysis run |

---

### Projects

#### `GET /api/projects`

List all projects with statistics.

**Response**:
```json
{
  "projects": [
    {
      "id": "prompt-evolution",
      "path": "/Users/dev/prompt-evolution",
      "displayName": "prompt-evolution",
      "conversationCount": 45,
      "lastActive": "2025-01-26T12:00:00.000Z",
      "avgEffectiveness": 0.75
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | string | Project identifier |
| path | string | Full filesystem path |
| displayName | string | Human-readable project name |
| conversationCount | number | Number of conversations |
| lastActive | string | ISO timestamp of last activity |
| avgEffectiveness | number | Average effectiveness score |

---

### Insights

#### `GET /api/insights`

Generate an insights report with optional filters.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | `30d` | Time period: `7d`, `30d`, `90d`, `all` |
| project | string | - | Filter by project ID |
| category | string | - | Filter by task category |
| focus | string | - | Focus area for recommendations |

**Example**:
```
GET /api/insights?period=7d&project=prompt-evolution
```

**Response**:
```json
{
  "generatedAt": "2025-01-26T12:00:00.000Z",
  "period": "7d",
  "summary": {
    "totalConversations": 25,
    "totalPrompts": 78,
    "overallEffectiveness": 0.72,
    "overallQuality": 0.68
  },
  "problems": [
    {
      "type": "missing_context",
      "description": "Prompts lack specific context",
      "frequency": 15,
      "impact": "high"
    }
  ],
  "improvements": [
    {
      "area": "output_specification",
      "suggestion": "Add expected output format",
      "examples": ["Example prompt..."]
    }
  ],
  "strengths": [
    {
      "area": "goal_clarity",
      "score": 0.85,
      "description": "Clear goal statements"
    }
  ],
  "categoryBreakdown": [
    {
      "category": "code-generation",
      "count": 30,
      "avgEffectiveness": 0.75
    }
  ],
  "recommendations": [
    "Focus on specifying expected output format",
    "Include more context about constraints"
  ],
  "promptLibrary": null,
  "guidelinesSummary": null,
  "selfImprovement": null
}
```

---

### Trends

#### `GET /api/trends`

Get time-series data for trend visualization.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | `30d` | Time period: `7d`, `30d`, `90d`, `all` |
| metric | string | `volume` | Metric: `volume`, `effectiveness`, `quality` |
| groupBy | string | `day` | Grouping: `day`, `week`, `month` |

**Example**:
```
GET /api/trends?period=30d&metric=effectiveness&groupBy=week
```

**Response**:
```json
{
  "metric": "effectiveness",
  "period": "30d",
  "groupBy": "week",
  "data": [
    { "date": "2025-01-01", "value": 0.68 },
    { "date": "2025-01-08", "value": 0.71 },
    { "date": "2025-01-15", "value": 0.73 },
    { "date": "2025-01-22", "value": 0.75 }
  ],
  "trend": "improving",
  "changePercent": 10.3
}
```

| Field | Type | Description |
|-------|------|-------------|
| metric | string | The measured metric |
| period | string | Time period analyzed |
| groupBy | string | Data point grouping |
| data | array | Time-series data points |
| trend | string | `improving`, `declining`, `stable` |
| changePercent | number | Percentage change between halves |

---

### Sync

#### `POST /api/sync`

Trigger manual data synchronization.

**Request Body**:
```json
{
  "mode": "incremental",
  "project": "prompt-evolution",
  "hoursBack": 24
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| mode | string | `incremental` | Sync mode: `incremental`, `analyze`, `full` |
| project | string | - | Filter to specific project |
| hoursBack | number | 24 | Hours to look back for analysis |

**Sync Modes**:
- `incremental`: Import new conversations only
- `analyze`: Re-analyze recent data without re-importing
- `full`: Full refresh (re-import all data)

**Response**:
```json
{
  "success": true,
  "mode": "incremental",
  "project": "prompt-evolution",
  "imported": 5,
  "analyzed": 5,
  "skipped": 0,
  "errors": [],
  "duration": 1234
}
```

#### `GET /api/sync/status`

Get current sync status and scheduler information.

**Response**:
```json
{
  "isRunning": false,
  "lastSync": "2025-01-26T10:00:00.000Z",
  "lastResult": {
    "imported": 10,
    "analyzed": 10,
    "errors": []
  },
  "nextScheduledSync": "2025-01-26T11:00:00.000Z",
  "scheduler": {
    "enabled": true,
    "interval": "1h"
  }
}
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "details": "Additional context if available"
}
```

**HTTP Status Codes**:

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid request parameters |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Rate Limiting

No rate limiting for local deployment. If deploying publicly, implement appropriate limits.

---

## Data Sources

The API reads from:
- `~/.claude/projects/{path}/*.jsonl` - Claude Code conversation logs
- Local SQLite database - Parsed and analyzed data
