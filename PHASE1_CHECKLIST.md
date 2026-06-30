# Phase 1 MVP Implementation Checklist

## ✅ Code Implementation Complete

### Video Upload
- [x] Upload API endpoint `/api/screens/[id]/upload` - handles video file uploads to Supabase Storage
- [x] File validation (video/* MIME type)
- [x] Unique filename generation per org/screen
- [x] Public URL generation

### Admin UI Updates
- [x] Screen editor now accepts both YouTube URLs and file uploads
- [x] File input with upload progress
- [x] Thumbnail previews (YouTube thumbnails + icon for uploaded videos)
- [x] Slide type badges (YouTube vs Uploaded)
- [x] Move/delete controls for all slide types

### TV Player Updates
- [x] Support for HTML5 `<video>` tag playback
- [x] Auto-detect video type (YouTube vs uploaded)
- [x] Show/hide YouTube player and video element based on current type
- [x] Auto-advance for both video types
- [x] Error handling - advance on playback error
- [x] Muted playback for autoplay compatibility

### Data Model
- [x] Slides changed from string[] to Slide[] with `{ url, type }` structure
- [x] Backward compatibility for old YouTube-only data (auto-converted)
- [x] Safe serialization to/from Supabase

---

## ⏳ Manual Setup Required

### 1. Create Supabase Storage Bucket
**Status:** Manual step via UI  
**Steps:**
1. Go to https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets
2. Click "New bucket"
3. Name it `videos`
4. Set visibility to **Public** (so TVs can play videos)
5. Click "Create bucket"

### 2. Enable Storage RLS
**Status:** Ready - execute SQL  
**Steps:**
1. Go to Supabase SQL Editor
2. Run the SQL from: `supabase-storage-setup.sql`
3. This sets up:
   - Upload permissions for authenticated users (their org only)
   - Read permissions for authenticated + anonymous users
   - Delete permissions for authenticated users (their org only)

### 3. Verify Environment Variables
**Check that these exist in `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
```

---

## 🧪 Testing Checklist

### Admin Flow
- [ ] Open dashboard → Click "+ Add screen"
- [ ] New screen created with PIN
- [ ] Click on screen to edit
- [ ] Add YouTube URL → Click "Add" → Video appears with thumbnail
- [ ] Upload an MP4 file → Blue icon appears, "Uploaded" label shown
- [ ] Reorder videos (up/down arrows work)
- [ ] Delete a video → Video removed
- [ ] Refresh page → Slides persist

### TV Flow
- [ ] Navigate to `/tv/[PIN]` (use actual PIN from screen)
- [ ] YouTube video plays fullscreen, muted, no controls
- [ ] When YouTube video ends → next video auto-plays
- [ ] When uploaded video ends → next video auto-plays
- [ ] Loop works (last → first)
- [ ] Video plays on TV browsers (test on Samsung Tizen / LG webOS if available)
- [ ] Update slides on admin while TV is playing → TV picks up changes on next cycle

### Error Handling
- [ ] Upload invalid file type → shows "Please select a video file"
- [ ] Upload fails (network error) → shows error message
- [ ] Video file fails to load on TV → skips to next video
- [ ] No videos added → shows PIN display with "No videos added yet"

---

## 📝 Known Limitations / Phase 2

- [ ] No remote pairing PIN system yet (TVs manually visit `/tv/[pin]` URL)
- [ ] No cloud sync - must update each TV with its own PIN
- [ ] No multi-user support
- [ ] No video duration display or progress bar
- [ ] No transcoding - uploads must be MP4 format that browsers support
- [ ] No bandwidth throttling - large files may take time to upload

---

## 🚀 Deployment

Once testing passes:
```bash
# 1. Commit changes
git add .
git commit -m "Add video upload and HTML5 playback support"

# 2. Push to production
git push origin main

# 3. Supabase migrations run automatically
# 4. Next.js deployment via your hosting (Vercel/Railway/etc)
```

---

## 🔧 Troubleshooting

**Q: Upload succeeds but video won't play on TV**
- A: Check Supabase Storage bucket is set to Public
- A: Check file is MP4 format (not MOV, MKV, etc)
- A: Check browser console for CORS errors

**Q: "No file provided" error**
- A: Check file input is working (try different browser)
- A: Check request size limits aren't hit (adjust if needed)

**Q: YouTube plays but uploaded video doesn't**
- A: Check HTML5 video tag is visible (not hidden by CSS)
- A: Check video MIME type is correct
- A: Try in different browser (may be codec support)

**Q: Slides array is empty on TV**
- A: Check `/api/tv/[pin]` endpoint returns data
- A: Check PIN is correct
- A: Check screen belongs to correct org
