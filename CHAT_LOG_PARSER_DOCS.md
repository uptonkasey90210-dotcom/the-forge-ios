# Open WebUI Chat Log Parser Implementation

## Overview
Implemented intelligent chat log parsing for Open WebUI JSON exports with automatic scene chunking based on time gaps.

---

## Function: `parseChatLog(fileContent: string): Scene[]`

### Purpose
Converts Open WebUI chat logs into screenplay scenes by:
1. Detecting message arrays/nested structures
2. Normalizing timestamps and message data
3. Chunking conversations by 2-hour time gaps
4. Formatting as readable dialogue scenes

---

## Implementation Details

### Step 1: Message Detection
**Detects multiple Open WebUI JSON structures:**

```typescript
// Standard messages array
{ messages: [...] }

// Nested in history
{ history: { messages: [...] } }

// Dictionary/map structure (common in some exports)
{ history: { "msg_1": {...}, "msg_2": {...} } }
```

### Step 2: Message Normalization

**Extracts and standardizes:**
- **Role:** `role`, `author`, or defaults to `'user'`
- **Content:** `content`, `message`, or `text` fields
- **Timestamp:** Supports multiple formats:
  - ISO 8601 strings: `"2024-01-10T14:30:00Z"`
  - Unix timestamps (seconds): `1704897000`
  - Alternative fields: `created_at`, `date`
  - Fallback: Uses message index with 60s intervals

**Process:**
1. Extract role, content, and timestamp from each message
2. Filter out empty messages
3. Sort chronologically by timestamp
4. Preserve original array index for debugging

### Step 3: Scene Chunking - Time Gap Rule

**Logic:**
```
IF time_difference_between_messages > 2 hours:
  CREATE new scene
ELSE:
  ADD message to current scene
```

**Example Timeline:**
```
Message 1: 2024-01-10 10:00 AM  \
Message 2: 2024-01-10 10:30 AM  ├─ SCENE 1 (< 2 hour gap)
Message 3: 2024-01-10 11:00 AM  /

[2 hour 5 minute gap]

Message 4: 2024-01-10 01:10 PM  \
Message 5: 2024-01-10 01:40 PM  ├─ SCENE 2 (new scene after gap)
Message 6: 2024-01-10 02:00 PM  /
```

### Step 4: Scene Formatting

**Format within each time chunk:**
```
[USER]: Your message here

[ASSISTANT]: Response here

[USER]: Follow-up message

[ASSISTANT]: Another response
```

---

## Scene Object Structure

Each parsed scene becomes:
```typescript
{
  id: number              // Auto-incremented
  text: string           // Formatted dialogue
  characters: []         // Empty (auto-populate from tags)
  mood: "Neutral"        // Default mood
  approved: false        // Awaiting review
  imageUrl?: string      // Will be populated by image generation
}
```

---

## Integration with TimelineView

**Workflow:**
1. User clicks "Select Files" button in TimelineView
2. File input triggers `handleChatLogUpload`
3. For JSON files:
   - Calls `parseChatLog(fileContent)`
   - Replaces `projectData.scenes` with parsed scenes
   - Updates project title with import metadata
4. Success alert shows number of scenes imported
5. Console logs details: `[Chat Log Parser] Parsed X scenes from Open WebUI log`

---

## Console Logging

Debug output includes:
```
[Chat Log Parser] Parsed 5 scenes from Open WebUI log
[Chat Log Parser Error] No messages found in chat log
```

---

## Error Handling

**Caught Scenarios:**
- ✓ Missing `messages` array or `history` object
- ✓ No valid messages after normalization
- ✓ Invalid JSON syntax
- ✓ Empty content fields
- ✓ Malformed timestamp data

**User Feedback:**
- Alert shows error message
- Console logs full error details
- No data loss (original project preserved)

---

## Open WebUI JSON Format Support

### Format 1: Simple Messages Array
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-10T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Hi there!",
      "timestamp": "2024-01-10T10:01:00Z"
    }
  ]
}
```

### Format 2: Nested History
```json
{
  "history": {
    "messages": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
}
```

### Format 3: Dictionary/Map Structure
```json
{
  "history": {
    "msg_1704897000": {
      "role": "user",
      "content": "Message 1"
    },
    "msg_1704897060": {
      "role": "assistant",
      "content": "Response 1"
    }
  }
}
```

---

## Timestamp Format Support

| Format | Example | Handling |
|--------|---------|----------|
| ISO 8601 | `"2024-01-10T14:30:00Z"` | `new Date(string)` |
| Unix (ms) | `1704897000000` | Direct usage |
| Unix (s) | `1704897000` | Multiply by 1000 |
| Named field | `created_at`, `date` | Fallback extraction |
| No timestamp | — | Index-based ordering |

---

## Scene Chunking Parameters

**Configurable:**
```typescript
const TWO_HOURS_MS = 2 * 60 * 60 * 1000  // 7,200,000 ms
```

**To adjust:**
- Modify `TWO_HOURS_MS` constant in `parseChatLog`
- 1 hour = `60 * 60 * 1000`
- 6 hours = `6 * 60 * 60 * 1000`

---

## Example Workflow

**Input:** Open WebUI export with 50 messages over 1 day
```
10:00 AM - Message 1
10:30 AM - Message 2
11:00 AM - Message 3
[3-hour gap due to offline time]
02:00 PM - Message 4
02:30 PM - Message 5
...
```

**Output:** 2+ scenes
```
SCENE 1 (10:00 AM - 11:00 AM):
  [USER]: Message 1
  [ASSISTANT]: Response 1
  [USER]: Message 2
  [ASSISTANT]: Response 2
  [USER]: Message 3
  [ASSISTANT]: Response 3

SCENE 2 (02:00 PM - ...):
  [USER]: Message 4
  [ASSISTANT]: Response 4
  [USER]: Message 5
  [ASSISTANT]: Response 5
```

---

## Data Persistence

**Auto-saved:**
- Parsed scenes stored in `projectData`
- localStorage saves via existing `useEffect` hook
- Project title updated with import filename
- Images can be generated independently for each scene

---

## Testing Checklist

- [ ] Parse standard Open WebUI JSON with messages array
- [ ] Parse nested history.messages structure
- [ ] Parse dictionary-based history (multiple message IDs)
- [ ] Verify 2-hour gap creates new scene
- [ ] Verify messages sorted chronologically
- [ ] Verify dialogue formatted as [ROLE]: content
- [ ] Verify empty messages filtered
- [ ] Verify project title updated
- [ ] Verify localStorage persists parsed scenes
- [ ] Verify error alerts on malformed JSON
- [ ] Verify console logs correct scene count
- [ ] Test with various timestamp formats
- [ ] Verify character list is empty (ready for tagging)
- [ ] Test image generation on imported scenes
- [ ] Verify PDF export works on imported scenes

---

## Advanced Features (Future)

- Character auto-detection from role extraction
- Sentiment analysis for automatic mood tagging
- Dialogue deduplication filter
- Configurable time gap threshold in UI
- Multiple file import (batch processing)
- Chat log merge (combine multiple exports)
- OCR for image-based chat logs
