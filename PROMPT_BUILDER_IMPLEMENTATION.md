# Stable Diffusion Prompt Builder Implementation

## Overview
Implemented intelligent prompt construction logic for Stable Diffusion image generation with full scene context awareness and character visual detail integration.

---

## Changes Made

### 1. Scene Interface Update
**File:** `app/page.tsx`

Added `imageUrl` field to persist generated images:
```typescript
interface Scene {
  id: number
  text: string
  characters: string[]
  mood: string
  approved: boolean
  imageUrl?: string  // NEW: Stores Base64 image data
}
```

---

### 2. Prompt Builder Function
**Function:** `constructSdPrompt(scene: Scene, castMembers: Character[]): string`

**Logic:**
- Extracts first 2-3 sentences from scene text for visual summary
- Retrieves character keywords from cast members present in the scene
- Combines components in priority order:
  1. Director's Style (from settings)
  2. Scene composition (visual summary)
  3. Mood
  4. Characters present
  5. Visual details (character-specific keywords)

**Example Output:**
```
You are a cinematic director. Write scenes in a noir style... | 
Scene composition: The neon lights flickered off the wet pavement as Commander Vex leaned across the cold metal table. | 
Mood: Tension | 
Characters present: Cmdr. Vex, Unknown Prisoner | 
Visual details: scar across left eye, cybernetic implant, silver hair... (Protagonist) | Unknown Prisoner (Support)
```

---

### 3. Updated Image Generation Function
**Function:** `generateSceneImage()`

**Enhanced Features:**
- Uses `constructSdPrompt()` to build rich, context-aware prompts
- Improved negative prompt: `"blurry, low quality, distorted, ugly, deformed, nsfw"`
- Payload parameters:
  - **steps:** 30 (increased from 20 for better quality)
  - **cfg_scale:** 7 (classifier-free guidance strength)
  - **sampler_name:** "Euler a" (recommended sampler)
  - **seed:** -1 (random, no caching)

**Response Handling:**
- Validates API response and image array
- Saves Base64 image to `scene.imageUrl` for persistence
- Updates `currentImage` state for immediate UI display
- Logs generation details for debugging
- Provides user feedback with success/error alerts

---

### 4. Scene Image Persistence
**Hook:** `useEffect` triggered on `activeSceneIndex` change

**Behavior:**
- Automatically loads `scene.imageUrl` when switching scenes
- Displays saved image if available
- Clears image state if scene has no saved image
- Integrated with localStorage via existing persistence hooks

---

## Request Payload Structure

```json
{
  "prompt": "Director Style | Scene Composition | Mood | Characters | Visual Details",
  "negative_prompt": "blurry, low quality, distorted, ugly, deformed, nsfw",
  "steps": 30,
  "cfg_scale": 7,
  "width": 768,
  "height": 512,
  "sampler_name": "Euler a",
  "seed": -1
}
```

---

## Response Handling

**Success Path:**
1. API returns `{ images: [base64_string, ...] }`
2. Encode as data URL: `data:image/png;base64,{image}`
3. Save to `scene.imageUrl`
4. Display in ProductionView
5. Auto-save to localStorage

**Error Handling:**
- Validates HTTP response status
- Checks for image array in response
- Provides detailed error messages
- Logs to console for debugging

---

## Usage Workflow

1. **Edit Scene** → User modifies scene text and character tags
2. **Regenerate Image** → Click "Regenerate (Variant B)" button
3. **Prompt Construction** → `constructSdPrompt()` combines all context
4. **API Call** → POST to Stable Diffusion with enhanced payload
5. **Image Persist** → Base64 saved to `scene.imageUrl`
6. **Auto-Display** → Switches scenes, previously generated images auto-load
7. **Auto-Save** → localStorage persists all scene images

---

## Console Logging

The implementation includes debug logging:
```
[SD Prompt Builder] Generated prompt: ...
[SD Image Gen] Scene image updated successfully
[SD Error] Details about any failures
```

These logs help troubleshoot generation issues without affecting UI.

---

## Technical Benefits

✅ **Context-Aware Prompts:** Director style + scene + mood + characters  
✅ **Visual Keyword Integration:** Character-specific visual details in prompts  
✅ **Quality Parameters:** 30 steps + cfg_scale 7 for better results  
✅ **Persistent Storage:** Images saved to scene objects and localStorage  
✅ **Responsive UI:** Auto-loads images when switching scenes  
✅ **Error Resilience:** Comprehensive error handling and user feedback  
✅ **Debuggable:** Console logging for troubleshooting  

---

## Testing Checklist

- [ ] Generate image for a scene with multiple characters
- [ ] Verify image saves to `scene.imageUrl` in localStorage
- [ ] Switch scenes and confirm previous images auto-load
- [ ] Test with different director styles
- [ ] Verify error handling with disconnected Stable Diffusion
- [ ] Check console logs for generation details
- [ ] Confirm negative prompt filters unwanted elements
- [ ] Test with various scene descriptions (short, long, action-heavy)
