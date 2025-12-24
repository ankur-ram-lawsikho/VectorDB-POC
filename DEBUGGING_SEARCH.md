# Debugging Similarity Search - Getting 0 Results

If you're getting 0 results when searching (e.g., "mongoDB"), here's how to debug and fix it:

## Quick Checks

### 1. Check if Items Have Embeddings

**Using the Web Interface:**
- Go to the Search tab
- Click "Check Embeddings" button
- This shows how many items have embeddings

**Using API:**
```bash
curl http://localhost:3000/api/media/stats/embeddings
```

**Expected Response:**
```json
{
  "totalItems": 10,
  "itemsWithEmbeddings": 8,
  "itemsWithoutEmbeddings": 2,
  "percentageWithEmbeddings": 80
}
```

### 2. Check Server Logs

When you search, the server now logs:
- How many items have embeddings
- How many results were found before distance filter
- The closest match distance
- How many results are returned after filtering

Look for messages like:
```
Searching 8 items with embeddings using cosine metric (maxDistance: 1.0)
Found 5 items (before distance filter)
Closest match distance: 0.85, threshold: 1.0
Returning 5 items (after distance filter)
```

## Common Issues and Solutions

### Issue 1: No Items Have Embeddings

**Symptoms:**
- `itemsWithEmbeddings: 0` in stats
- Server log shows: "No items with embeddings found in database"

**Solution:**
1. Run the backfill script to generate embeddings for existing items:
   ```bash
   npm run backfill:embeddings
   ```

2. Or recreate items (embeddings are generated automatically on creation)

### Issue 2: Distance Threshold Too Strict

**Symptoms:**
- Items have embeddings
- Server log shows: "Found X items (before distance filter)" but "Returning 0 items"
- Closest match distance is higher than threshold

**Solution:**
1. **Increase Max Distance Threshold:**
   - In the web UI, increase the "Max Distance Threshold" slider
   - Default is now 1.0 (was 0.5), try 1.5 or 2.0
   - For cosine: 0.0-0.3 = very similar, 0.3-0.7 = related, 0.7-1.0 = somewhat related, 1.0-2.0 = unrelated

2. **Via API:**
   ```bash
   curl -X POST http://localhost:3000/api/media/search \
     -H "Content-Type: application/json" \
     -d '{
       "query": "mongoDB",
       "limit": 10,
       "maxDistance": 2.0,
       "metric": "cosine"
     }'
   ```

### Issue 3: No Relevant Content in Database

**Symptoms:**
- Items have embeddings
- Distance threshold is high enough
- But still 0 results

**Solution:**
- The search is working, but there's no content related to your query
- Create items with content related to your search term
- For "mongoDB", create items mentioning MongoDB, databases, NoSQL, etc.

### Issue 4: Embedding Generation Failed

**Symptoms:**
- Items were created but embeddings are null
- Check server logs for "Error saving embedding" messages

**Solution:**
1. Check GEMINI_API_KEY is set correctly in `.env`
2. Check API key is valid and has quota
3. Check server logs for specific error messages
4. Try recreating an item to see if embedding generation works

## Testing Steps

### Step 1: Verify Items Exist
```bash
curl http://localhost:3000/api/media
```

### Step 2: Check Embedding Stats
```bash
curl http://localhost:3000/api/media/stats/embeddings
```

### Step 3: Create a Test Item About MongoDB
```bash
curl -X POST http://localhost:3000/api/media/text \
  -H "Content-Type: application/json" \
  -d '{
    "title": "MongoDB Introduction",
    "content": "MongoDB is a NoSQL database that stores data in flexible JSON-like documents.",
    "description": "Introduction to MongoDB database"
  }'
```

Wait a few seconds for embedding to generate, then search.

### Step 4: Search with High Threshold
```bash
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mongoDB",
    "limit": 10,
    "maxDistance": 2.0,
    "metric": "cosine"
  }'
```

### Step 5: Check Server Logs
Look at the console where `npm run dev` is running for detailed debug information.

## Understanding Distance Values

### Cosine Distance (default)
- **0.0**: Identical
- **0.0-0.3**: Very similar (same topic)
- **0.3-0.7**: Related (similar concepts)
- **0.7-1.0**: Somewhat related
- **1.0-2.0**: Unrelated or opposite

### Recommended Thresholds
- **Strict (0.1-0.3)**: Only very similar results
- **Moderate (0.5-0.7)**: Related results
- **Permissive (1.0-2.0)**: All results, even loosely related

## Debugging Tips

1. **Start with high threshold (2.0)** to see all possible matches
2. **Check server logs** - they now show detailed search information
3. **Use the "Check Embeddings" button** in the web UI
4. **Try different metrics** - cosine, L2, inner_product may give different results
5. **Check if your query makes sense** - search for content that actually exists

## Example: Debugging "mongoDB" Search

```bash
# 1. Check if items exist
curl http://localhost:3000/api/media | jq 'length'

# 2. Check embedding stats
curl http://localhost:3000/api/media/stats/embeddings | jq

# 3. Search with very permissive threshold
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d '{"query": "mongoDB", "maxDistance": 2.0, "limit": 20}' | jq

# 4. Check server logs for detailed info
```

If you still get 0 results after these steps, the issue is likely that:
- No items in your database are semantically related to "mongoDB"
- You need to create items with MongoDB-related content first

