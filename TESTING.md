# Testing Similarity Search

This guide shows you how to test the similarity search functionality in the VectorDB Media Library.

## Prerequisites

1. Make sure the server is running:
   ```bash
   npm run dev
   ```

2. Ensure you have some media items with embeddings. If you have existing items without embeddings, you can:
   - Delete and recreate them (embeddings are generated on creation)
   - Or run the backfill script: `npm run backfill:embeddings`

## Testing Methods

### Method 1: Using the Web Interface

1. Open your browser and go to `http://localhost:3000`
2. Add some test media items (text, video links, etc.)
3. Use the "Search" tab to test text-based similarity search
4. Click on any media item to find similar items (feature coming in updated UI)

### Method 2: Using cURL Commands

#### Test 1: Create Test Media Items

First, create some sample media items to search:

```bash
# Create a text item about contracts
curl -X POST http://localhost:3000/api/media/text \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Introduction to Contracts\",
    \"content\": \"A contract is a legally binding agreement between two or more parties. It requires offer, acceptance, and consideration.\",
    \"description\": \"Basic contract law concepts\"
  }"

# Create another text item about contracts
curl -X POST http://localhost:3000/api/media/text \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Contract Formation\",
    \"content\": \"For a contract to be valid, there must be mutual assent, consideration, capacity, and legality. The parties must agree on the essential terms.\",
    \"description\": \"Elements required for contract formation\"
  }"

# Create a text item about property law (different topic)
curl -X POST http://localhost:3000/api/media/text \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Property Rights\",
    \"content\": \"Property law governs the various forms of ownership and tenancy in real property and personal property.\",
    \"description\": \"Overview of property law\"
  }"

# Create a video link about contracts
curl -X POST http://localhost:3000/api/media/video \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Contract Law Explained\",
    \"url\": \"https://youtube.com/watch?v=example\",
    \"description\": \"Video explaining contract law principles and case studies\"
  }"
```

**Note:** Save the `id` values from the responses - you'll need them for testing!

#### Test 2: Text-Based Similarity Search

```bash
# Basic search with default settings (cosine distance)
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"What are the requirements for a valid contract?\",
    \"limit\": 5
  }"

# Search with custom distance metric (L2)
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"contract law\",
    \"limit\": 10,
    \"metric\": \"l2\",
    \"maxDistance\": 1.0
  }"

# Search with inner product metric
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"legal agreements between parties\",
    \"limit\": 5,
    \"metric\": \"inner_product\",
    \"maxDistance\": 10.0
  }"

# Search with strict similarity threshold
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"contracts\",
    \"limit\": 10,
    \"maxDistance\": 0.3,
    \"metric\": \"cosine\"
  }"
```

#### Test 3: Find Similar Items by Media ID

Replace `{MEDIA_ID}` with an actual ID from your created items:

```bash
# Find similar items to a specific media item (default: cosine)
curl "http://localhost:3000/api/media/{MEDIA_ID}/similar?limit=5"

# Find similar items with custom parameters
curl "http://localhost:3000/api/media/{MEDIA_ID}/similar?limit=10&metric=l2&maxDistance=1.0"

# Find similar items with inner product metric
curl "http://localhost:3000/api/media/{MEDIA_ID}/similar?limit=5&metric=inner_product&maxDistance=10.0"
```

#### Test 4: Get All Media Items (to find IDs)

```bash
curl http://localhost:3000/api/media
```

### Method 3: Using PowerShell (Windows)

If you're on Windows, you can use PowerShell's `Invoke-RestMethod`:

```powershell
# Create a text item
$body = @{
    title = "Contract Law Basics"
    content = "A contract requires offer, acceptance, and consideration to be legally binding."
    description = "Introduction to contract law"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/media/text" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

# Search for similar items
$searchBody = @{
    query = "legal contracts"
    limit = 5
    metric = "cosine"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/media/search" `
    -Method POST `
    -ContentType "application/json" `
    -Body $searchBody
```

### Method 4: Using Postman or Insomnia

#### Search Endpoint
- **Method:** POST
- **URL:** `http://localhost:3000/api/media/search`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**
```json
{
  "query": "contract law",
  "limit": 10,
  "maxDistance": 0.5,
  "metric": "cosine"
}
```

#### Find Similar Items Endpoint
- **Method:** GET
- **URL:** `http://localhost:3000/api/media/{id}/similar?limit=5&metric=cosine&maxDistance=0.5`
- Replace `{id}` with an actual media item ID

## Expected Response Format

### Search Response
```json
{
  "query": "contract law",
  "count": 3,
  "results": [
    {
      "id": "uuid-here",
      "title": "Introduction to Contracts",
      "type": "text",
      "content": "...",
      "description": "...",
      "similarity": 0.85,
      "distance": 0.15,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Similar Items Response
```json
{
  "sourceId": "uuid-here",
  "count": 2,
  "results": [
    {
      "id": "uuid-2",
      "title": "Contract Formation",
      "similarity": 0.92,
      "distance": 0.08,
      ...
    }
  ]
}
```

## Understanding the Results

- **similarity**: Score from 0-1, where higher = more similar
  - For cosine: `1 - distance` (1 = identical, 0 = orthogonal)
  - For L2: `1 / (1 + distance)` (normalized)
  - For inner product: negative inner product (higher = more similar)

- **distance**: Raw distance metric value
  - Cosine: 0 = identical, 1 = orthogonal, 2 = opposite
  - L2: 0 = identical, larger = more different
  - Inner product: lower = more similar

## Testing Scenarios

### Scenario 1: Semantic Search
1. Create items about "contracts", "agreements", "legal documents"
2. Search for "binding agreements"
3. Should return all contract-related items, even if they don't contain the exact words

### Scenario 2: Different Topics
1. Create items about "contracts" and "property law"
2. Search for "contracts"
3. Should return contract items with high similarity, property items with lower similarity

### Scenario 3: Find Similar Items
1. Create multiple items about the same topic
2. Get the ID of one item
3. Use the `/similar` endpoint
4. Should return other items on the same topic

### Scenario 4: Distance Metrics Comparison
1. Search the same query with different metrics (cosine, l2, inner_product)
2. Compare the results and similarity scores
3. Note that different metrics may rank items differently

## Troubleshooting

### No Results Returned
- Check if items have embeddings (they're generated on creation)
- Try increasing `maxDistance` threshold
- Verify items exist: `GET /api/media`

### Low Similarity Scores
- This is normal - similarity depends on how similar the content actually is
- Try different search queries
- Check if embeddings were generated successfully

### Error: "Media item not found"
- Verify the ID exists using `GET /api/media`
- Check the ID format (should be UUID)

### Error: "Source media item does not have an embedding"
- The source item needs an embedding to find similar items
- Recreate the item or run the backfill script

## Quick Test Script

Save this as `test-similarity.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000/api/media"

echo "Creating test items..."
ITEM1=$(curl -s -X POST $BASE_URL/text \
  -H "Content-Type: application/json" \
  -d '{"title":"Contract Law","content":"Contracts require offer and acceptance","description":"Basic contract concepts"}')

ITEM2=$(curl -s -X POST $BASE_URL/text \
  -H "Content-Type: application/json" \
  -d '{"title":"Property Law","content":"Property rights govern ownership","description":"Property concepts"}')

echo "Items created!"
echo "Item 1: $ITEM1"
echo "Item 2: $ITEM2"

echo -e "\nSearching for 'contracts'..."
curl -X POST $BASE_URL/search \
  -H "Content-Type: application/json" \
  -d '{"query":"contracts","limit":5}' | jq

echo -e "\nDone!"
```

Run with: `bash test-similarity.sh` (requires `jq` for JSON formatting)


