# Recommendation System Guide

## Overview

The recommendation system uses vector similarity to provide intelligent recommendations based on:
- **Item-based recommendations**: Find items similar to a specific item
- **Multi-item recommendations**: Find items similar to multiple items (user preferences)
- **Content-based recommendations**: Find items similar to a text query/description
- **Hybrid recommendations**: Combine multiple strategies for better results

All recommendations use cosine similarity on vector embeddings to find semantically similar content.

## How It Works

### 1. Vector Similarity

The system uses the same embedding model (Google Gemini `text-embedding-004`) as the search functionality:
- Items are converted to 768-dimensional vectors
- Similarity is measured using cosine distance
- Higher similarity scores (0-1) indicate more similar content

### 2. Recommendation Strategies

#### Item-Based Recommendations
- **Use case**: "Show me items similar to this one"
- **How it works**: Takes a single item's embedding and finds the most similar items
- **Best for**: Related content discovery, "more like this" features

#### Multi-Item Recommendations
- **Use case**: "Show me items similar to my favorites/liked items"
- **How it works**: Calculates average embedding from multiple items, then finds similar items
- **Best for**: User preference-based recommendations, personalized suggestions

#### Content-Based Recommendations
- **Use case**: "Show me items about 'database management'"
- **How it works**: Converts text query to embedding, finds similar items
- **Best for**: Interest-based discovery, topic exploration

#### Hybrid Recommendations
- **Use case**: "Show me items similar to my favorites AND about 'databases'"
- **How it works**: Combines item-based and content-based strategies with weighted scores
- **Best for**: Complex recommendation scenarios, combining user preferences with interests

## Mathematical Foundations & Calculations

This section explains the mathematical formulas and calculations used in the recommendation system.

### 1. Vector Embeddings

Each item is represented as a 768-dimensional vector:

```
Item → Embedding Vector: [v₁, v₂, v₃, ..., v₇₆₈]
```

**Example:**
```
"MongoDB Tutorial" → [0.123, -0.456, 0.789, ..., 0.234]
"Database Guide"   → [0.145, -0.432, 0.801, ..., 0.221]
```

### 2. Cosine Distance

The system uses **cosine distance** to measure how different two vectors are. Cosine distance measures the angle between two vectors, regardless of their magnitude.

#### Cosine Distance Formula

```
Cosine Distance = 1 - Cosine Similarity
```

Where **Cosine Similarity** is calculated as:

```
Cosine Similarity = (A · B) / (||A|| × ||B||)
```

Expanded form:

```
Cosine Similarity = Σ(Aᵢ × Bᵢ) / (√(ΣAᵢ²) × √(ΣBᵢ²))
```

**Where:**
- `A` and `B` are the two vectors
- `A · B` is the dot product: `Σ(Aᵢ × Bᵢ)`
- `||A||` is the magnitude (L2 norm): `√(ΣAᵢ²)`
- `||B||` is the magnitude (L2 norm): `√(ΣBᵢ²)`

#### Cosine Distance Range

- **0**: Vectors are identical (same direction)
- **1**: Vectors are orthogonal (perpendicular, no similarity)
- **2**: Vectors are opposite (completely different)

#### Example Calculation

Given two vectors:
```
A = [0.5, 0.3, 0.8]
B = [0.4, 0.2, 0.9]
```

**Step 1: Calculate Dot Product**
```
A · B = (0.5 × 0.4) + (0.3 × 0.2) + (0.8 × 0.9)
      = 0.20 + 0.06 + 0.72
      = 0.98
```

**Step 2: Calculate Magnitudes**
```
||A|| = √(0.5² + 0.3² + 0.8²)
      = √(0.25 + 0.09 + 0.64)
      = √0.98
      = 0.990

||B|| = √(0.4² + 0.2² + 0.9²)
      = √(0.16 + 0.04 + 0.81)
      = √1.01
      = 1.005
```

**Step 3: Calculate Cosine Similarity**
```
Cosine Similarity = 0.98 / (0.990 × 1.005)
                  = 0.98 / 0.995
                  = 0.985
```

**Step 4: Calculate Cosine Distance**
```
Cosine Distance = 1 - 0.985
                = 0.015
```

**Step 5: Convert to Similarity Score (0-1)**
```
Similarity = 1 - Cosine Distance
           = 1 - 0.015
           = 0.985
```

### 3. Similarity Score Conversion

The system converts cosine distance to similarity score for easier interpretation:

```
Similarity = 1 - Cosine Distance
```

**Range:**
- **1.0**: Perfectly similar (distance = 0)
- **0.5**: Moderately similar (distance = 0.5)
- **0.0**: Not similar (distance = 1.0 or greater)

**Example:**
```
Distance = 0.15  →  Similarity = 1 - 0.15 = 0.85 (85% similar)
Distance = 0.30  →  Similarity = 1 - 0.30 = 0.70 (70% similar)
Distance = 0.50  →  Similarity = 1 - 0.50 = 0.50 (50% similar)
```

### 4. Item-Based Recommendations Calculation

For item-based recommendations, the system:

1. **Gets source item embedding**: `E_source`
2. **Calculates distance** to all other items: `distance = E_source <=> E_item`
3. **Converts to similarity**: `similarity = 1 - distance`
4. **Filters by threshold**: `similarity >= minSimilarity`
5. **Sorts by distance** (ascending) or similarity (descending)

**Formula:**
```
For each candidate item:
  distance = cosine_distance(E_source, E_candidate)
  similarity = 1 - distance
  
  if similarity >= minSimilarity:
    include in recommendations
```

### 5. Multi-Item Recommendations Calculation

For multi-item recommendations, the system calculates an **average embedding** from multiple source items.

#### Average Embedding Formula

Given `n` items with embeddings `E₁, E₂, ..., Eₙ`:

```
E_avg = [avg₁, avg₂, ..., avg₇₆₈]
```

Where each dimension is averaged:

```
avgᵢ = (E₁ᵢ + E₂ᵢ + ... + Eₙᵢ) / n
```

**Expanded:**
```
E_avg = [
  (E₁₁ + E₂₁ + ... + Eₙ₁) / n,
  (E₁₂ + E₂₂ + ... + Eₙ₂) / n,
  ...
  (E₁₇₆₈ + E₂₇₆₈ + ... + Eₙ₇₆₈) / n
]
```

#### Example Calculation

Given 2 items:
```
E₁ = [0.5, 0.3, 0.8]
E₂ = [0.4, 0.2, 0.9]
```

**Calculate average:**
```
E_avg = [
  (0.5 + 0.4) / 2,  // = 0.45
  (0.3 + 0.2) / 2,  // = 0.25
  (0.8 + 0.9) / 2   // = 0.85
]
E_avg = [0.45, 0.25, 0.85]
```

Then the system uses `E_avg` to find similar items using the same cosine distance calculation.

### 6. Content-Based Recommendations Calculation

For content-based recommendations:

1. **Generate query embedding**: Convert text query to vector `E_query`
2. **Calculate distance** to all items: `distance = E_query <=> E_item`
3. **Convert to similarity**: `similarity = 1 - distance`
4. **Filter and sort** same as item-based

**Formula:**
```
E_query = generate_embedding(query_text)

For each candidate item:
  distance = cosine_distance(E_query, E_item)
  similarity = 1 - distance
  
  if similarity >= minSimilarity:
    include in recommendations
```

### 7. Hybrid Recommendations Calculation

Hybrid recommendations combine multiple strategies using **weighted scores**.

#### Score Combination Formula

For an item that appears in both item-based and content-based results:

```
Final Score = (ItemScore × W_item) + (ContentScore × W_content)
```

**Where:**
- `ItemScore`: Similarity from item-based recommendation
- `ContentScore`: Similarity from content-based recommendation
- `W_item`: Weight for item-based (default: 0.5)
- `W_content`: Weight for content-based (default: 0.5)

#### Example Calculation

Given:
- Item-based similarity: `0.85`
- Content-based similarity: `0.70`
- Weights: `W_item = 0.6`, `W_content = 0.4`

**Calculate final score:**
```
Final Score = (0.85 × 0.6) + (0.70 × 0.4)
            = 0.51 + 0.28
            = 0.79
```

#### Multiple Item Sources

If an item appears from multiple item-based sources:

```
Combined ItemScore = (Score₁ × W₁) + (Score₂ × W₂) + ... + (Scoreₙ × Wₙ)
```

Then:
```
Final Score = Combined ItemScore + (ContentScore × W_content)
```

### 8. Threshold Filtering

The system uses progressive threshold lowering to ensure results are returned:

#### Progressive Threshold Algorithm

```
1. Start with minSimilarity (default: 0.3)
2. Filter results: similarity >= minSimilarity
3. If results < limit:
   a. Try threshold = 0.2
   b. If still insufficient, try 0.1
   c. Then try 0.05
   d. Finally try 0.0 (return all candidates)
4. Return top 'limit' results
```

**Example:**
```
Request: limit = 10, minSimilarity = 0.5
Found: 3 results with similarity >= 0.5

Step 1: Try 0.2 → Found 8 results
Step 2: Try 0.1 → Found 12 results ✓
Return: Top 10 results (similarity >= 0.1)
```

### 9. Recommendation Score Calculation

The **recommendationScore** is the final weighted score used for ranking:

#### For Item-Based / Multi-Item / Content-Based:
```
recommendationScore = similarity
```

#### For Hybrid:
```
recommendationScore = (ItemScore × W_item) + (ContentScore × W_content)
```

### 10. Metadata Calculations

The system calculates several metadata metrics:

#### Average Similarity
```
avgSimilarity = (Σ similarityᵢ) / n
```

**Example:**
```
Similarities: [0.85, 0.78, 0.72, 0.65, 0.60]
avgSimilarity = (0.85 + 0.78 + 0.72 + 0.65 + 0.60) / 5
              = 3.60 / 5
              = 0.72
```

#### Min/Max Similarity
```
minSimilarity = min(similarity₁, similarity₂, ..., similarityₙ)
maxSimilarity = max(similarity₁, similarity₂, ..., similarityₙ)
```

### 11. SQL Implementation

The actual calculation is performed in PostgreSQL using pgvector:

```sql
-- Cosine distance calculation
SELECT 
  embedding::vector <=> $1::vector AS distance,
  1 - (embedding::vector <=> $1::vector) AS similarity
FROM media_items
WHERE embedding IS NOT NULL
ORDER BY distance ASC
LIMIT 10;
```

**Where:**
- `<=>` is the cosine distance operator
- `$1` is the query/source vector
- Results are ordered by distance (ascending = most similar first)

### 12. Complete Calculation Example

Let's trace through a complete item-based recommendation:

**Input:**
- Source item ID: `abc-123`
- Source embedding: `[0.5, 0.3, 0.8, ...]` (768 dimensions)
- Limit: 5
- Min similarity: 0.3

**Step 1: Find candidate items**
```sql
SELECT id, embedding, 
       embedding::vector <=> '[0.5, 0.3, 0.8, ...]'::vector AS distance
FROM media_items
WHERE embedding IS NOT NULL AND id != 'abc-123'
ORDER BY distance ASC
LIMIT 10
```

**Step 2: Calculate similarities**
```
Item def-456: distance = 0.15 → similarity = 0.85 ✓
Item ghi-789: distance = 0.22 → similarity = 0.78 ✓
Item jkl-012: distance = 0.28 → similarity = 0.72 ✓
Item mno-345: distance = 0.35 → similarity = 0.65 ✓
Item pqr-678: distance = 0.42 → similarity = 0.58 ✓
Item stu-901: distance = 0.52 → similarity = 0.48 ✓
Item vwx-234: distance = 0.61 → similarity = 0.39 ✓
Item yza-567: distance = 0.75 → similarity = 0.25 ✗ (below threshold)
```

**Step 3: Filter by threshold**
```
Filtered: similarity >= 0.3
Results: def-456, ghi-789, jkl-012, mno-345, pqr-678, stu-901, vwx-234
```

**Step 4: Limit results**
```
Top 5: def-456, ghi-789, jkl-012, mno-345, pqr-678
```

**Step 5: Calculate metadata**
```
totalCandidates = 7
filteredResults = 5
averageSimilarity = (0.85 + 0.78 + 0.72 + 0.65 + 0.58) / 5 = 0.716
minSimilarity = 0.58
maxSimilarity = 0.85
```

**Final Response:**
```json
{
  "recommendations": [
    { "item": {...}, "similarity": 0.85, "recommendationScore": 0.85 },
    { "item": {...}, "similarity": 0.78, "recommendationScore": 0.78 },
    { "item": {...}, "similarity": 0.72, "recommendationScore": 0.72 },
    { "item": {...}, "similarity": 0.65, "recommendationScore": 0.65 },
    { "item": {...}, "similarity": 0.58, "recommendationScore": 0.58 }
  ],
  "metadata": {
    "totalCandidates": 7,
    "filteredResults": 5,
    "averageSimilarity": 0.716,
    "minSimilarity": 0.58,
    "maxSimilarity": 0.85
  }
}
```

### 13. Formula Summary

| Calculation | Formula |
|------------|---------|
| **Cosine Similarity** | `(A · B) / (||A|| × ||B||)` |
| **Cosine Distance** | `1 - Cosine Similarity` |
| **Similarity Score** | `1 - Cosine Distance` |
| **Average Embedding** | `E_avg = [ΣE₁ᵢ/n, ΣE₂ᵢ/n, ..., ΣEₙᵢ/n]` |
| **Hybrid Score** | `(ItemScore × W_item) + (ContentScore × W_content)` |
| **Average Similarity** | `Σsimilarityᵢ / n` |

### 14. Key Properties

1. **Commutative**: `distance(A, B) = distance(B, A)`
2. **Range**: Distance ∈ [0, 2], Similarity ∈ [0, 1]
3. **Normalization**: Cosine distance is normalized (magnitude-independent)
4. **Semantic**: Similar meanings produce similar vectors
5. **Dimensionality**: All embeddings are 768-dimensional

## API Endpoints

### 1. Item-Based Recommendations

**GET** `/api/media/recommendations/item/:id`

Get recommendations based on a single item.

**Query Parameters:**
- `limit` (number, default: 10): Maximum number of recommendations
- `minSimilarity` (number, default: 0.3): Minimum similarity threshold (0-1)
- `excludeIds` (string, comma-separated): Item IDs to exclude from results

**Example Request:**
```bash
GET /api/media/recommendations/item/abc-123?limit=5&minSimilarity=0.4
```

**Example Response:**
```json
{
  "strategy": "item-based",
  "sourceItems": ["abc-123"],
  "recommendations": [
    {
      "item": {
        "id": "def-456",
        "title": "MongoDB Advanced Guide",
        "type": "text",
        "description": "Advanced MongoDB concepts",
        ...
      },
      "similarity": 0.85,
      "distance": 0.15,
      "recommendationScore": 0.85,
      "reason": "Similar to \"MongoDB Tutorial\""
    }
  ],
  "metadata": {
    "totalCandidates": 25,
    "filteredResults": 5,
    "averageSimilarity": 0.78,
    "minSimilarity": 0.65,
    "maxSimilarity": 0.85
  }
}
```

### 2. Multi-Item Recommendations

**POST** `/api/media/recommendations/multi-item`

Get recommendations based on multiple items (user preferences).

**Request Body:**
```json
{
  "itemIds": ["abc-123", "def-456", "ghi-789"],
  "limit": 10,
  "minSimilarity": 0.3,
  "excludeIds": ["jkl-012"]
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/media/recommendations/multi-item \
  -H "Content-Type: application/json" \
  -d '{
    "itemIds": ["abc-123", "def-456"],
    "limit": 5,
    "minSimilarity": 0.4
  }'
```

**Example Response:**
```json
{
  "strategy": "multi-item",
  "sourceItems": ["abc-123", "def-456"],
  "recommendations": [
    {
      "item": { ... },
      "similarity": 0.82,
      "distance": 0.18,
      "recommendationScore": 0.82,
      "reason": "Similar to your preferences (MongoDB Tutorial, Database Guide)"
    }
  ],
  "metadata": { ... }
}
```

### 3. Content-Based Recommendations

**POST** `/api/media/recommendations/content-based`

Get recommendations based on a text query.

**Request Body:**
```json
{
  "query": "database management and optimization",
  "limit": 10,
  "minSimilarity": 0.3,
  "excludeIds": []
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/media/recommendations/content-based \
  -H "Content-Type: application/json" \
  -d '{
    "query": "MongoDB performance tuning",
    "limit": 5
  }'
```

**Example Response:**
```json
{
  "strategy": "content-based",
  "sourceQuery": "MongoDB performance tuning",
  "recommendations": [
    {
      "item": { ... },
      "similarity": 0.88,
      "distance": 0.12,
      "recommendationScore": 0.88,
      "reason": "Matches your interest: \"MongoDB performance tuning\""
    }
  ],
  "metadata": { ... }
}
```

### 4. Hybrid Recommendations

**POST** `/api/media/recommendations/hybrid`

Get recommendations combining multiple strategies.

**Request Body:**
```json
{
  "itemIds": ["abc-123", "def-456"],
  "query": "database optimization",
  "limit": 10,
  "minSimilarity": 0.3,
  "excludeIds": [],
  "weights": {
    "itemBased": 0.6,
    "contentBased": 0.4
  }
}
```

**Parameters:**
- `itemIds` (string[], optional): Source item IDs
- `query` (string, optional): Text query
- `limit` (number, default: 10): Maximum recommendations
- `minSimilarity` (number, default: 0.3): Minimum similarity threshold
- `excludeIds` (string[], optional): Item IDs to exclude
- `weights` (object, optional): Strategy weights (must sum to 1.0 for best results)

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/media/recommendations/hybrid \
  -H "Content-Type: application/json" \
  -d '{
    "itemIds": ["abc-123"],
    "query": "database tutorials",
    "limit": 5,
    "weights": {
      "itemBased": 0.5,
      "contentBased": 0.5
    }
  }'
```

### 5. Auto-Detect Recommendations

**POST** `/api/media/recommendations`

Automatically detects the best strategy based on provided parameters.

**Request Body:**
```json
{
  "itemId": "abc-123",
  "query": "database management",
  "strategy": "hybrid",
  "limit": 10,
  "minSimilarity": 0.3
}
```

**Auto-Detection Logic:**
- If only `itemId` provided → `item-based`
- If only `itemIds` (array) provided → `multi-item` (if multiple) or `item-based` (if single)
- If only `query` provided → `content-based`
- If both `itemIds` and `query` provided → `hybrid`
- If `strategy` explicitly provided → uses that strategy

## Response Format

All recommendation endpoints return the same response structure:

```typescript
{
  strategy: 'item-based' | 'multi-item' | 'content-based' | 'hybrid';
  sourceItems?: string[];        // IDs of source items (if applicable)
  sourceQuery?: string;           // Query used (if applicable)
  recommendations: Array<{
    item: MediaItem;              // The recommended item
    similarity: number;          // Similarity score (0-1)
    distance: number;            // Vector distance
    recommendationScore: number; // Weighted recommendation score
    reason?: string;             // Why this was recommended
  }>;
  metadata: {
    totalCandidates: number;      // Total items considered
    filteredResults: number;     // Number of results after filtering
    averageSimilarity: number;    // Average similarity of results
    minSimilarity: number;        // Minimum similarity in results
    maxSimilarity: number;        // Maximum similarity in results
  };
}
```

## Best Practices

### 1. Choosing the Right Strategy

**Use Item-Based when:**
- You have a specific item the user is viewing
- You want "more like this" functionality
- You need simple, fast recommendations

**Use Multi-Item when:**
- You have user preferences (liked items, favorites, history)
- You want personalized recommendations
- You have multiple items to base recommendations on

**Use Content-Based when:**
- User provides a text query or description
- You want to explore topics
- You need interest-based discovery

**Use Hybrid when:**
- You want to combine user preferences with interests
- You need more sophisticated recommendations
- You have both item data and query data

### 2. Setting Similarity Thresholds

- **Strict (0.5-0.7)**: Only very similar items
  - Use when you want high-quality, highly relevant recommendations
  - May return fewer results

- **Moderate (0.3-0.5)**: Balanced recommendations (default)
  - Good balance between relevance and coverage
  - Recommended for most use cases

- **Permissive (0.1-0.3)**: Loosely related items
  - Use when you want more diverse recommendations
  - May include less relevant items

- **Very Permissive (0.0-0.1)**: All items
  - Use when you want maximum coverage
  - Results may be less relevant

**Note:** The system automatically lowers the threshold if not enough results are found.

### 3. Hybrid Recommendation Weights

When using hybrid recommendations, adjust weights based on your priorities:

```json
{
  "weights": {
    "itemBased": 0.7,    // Prioritize user preferences
    "contentBased": 0.3  // Less weight on query
  }
}
```

```json
{
  "weights": {
    "itemBased": 0.3,    // Less weight on preferences
    "contentBased": 0.7  // Prioritize query match
  }
}
```

**Best Practice:** Weights should sum to 1.0 for consistent scoring, but the system will work with any weights.

### 4. Excluding Items

Use `excludeIds` to prevent showing:
- Items the user has already seen
- The source item itself (automatically excluded in item-based)
- Items you don't want to recommend

```json
{
  "itemId": "abc-123",
  "excludeIds": ["def-456", "ghi-789", "jkl-012"]
}
```

## Examples

### Example 1: "More Like This"

**Scenario:** User is viewing "MongoDB Tutorial" and wants similar content.

```bash
GET /api/media/recommendations/item/abc-123?limit=5
```

**Result:** Returns 5 items similar to MongoDB Tutorial, such as:
- "MongoDB Advanced Guide" (similarity: 0.85)
- "NoSQL Database Tutorial" (similarity: 0.78)
- "Database Design Principles" (similarity: 0.72)

### Example 2: Personalized Recommendations

**Scenario:** User has liked 3 items about databases and wants recommendations.

```bash
POST /api/media/recommendations/multi-item
{
  "itemIds": ["item-1", "item-2", "item-3"],
  "limit": 10
}
```

**Result:** Returns items that match the user's overall preferences (average of the 3 items).

### Example 3: Topic Exploration

**Scenario:** User wants to explore "contract law basics".

```bash
POST /api/media/recommendations/content-based
{
  "query": "contract law basics",
  "limit": 10
}
```

**Result:** Returns items semantically related to contract law, even if they don't contain the exact phrase.

### Example 4: Combined Recommendations

**Scenario:** User has liked database items AND wants to explore "performance optimization".

```bash
POST /api/media/recommendations/hybrid
{
  "itemIds": ["db-item-1", "db-item-2"],
  "query": "performance optimization",
  "limit": 10,
  "weights": {
    "itemBased": 0.5,
    "contentBased": 0.5
  }
}
```

**Result:** Returns items that are both similar to user's preferences AND related to performance optimization.

## Performance Considerations

### Response Time
- **Item-based**: ~100-300ms (fastest)
- **Multi-item**: ~150-400ms (slightly slower due to embedding averaging)
- **Content-based**: ~200-500ms (includes embedding generation)
- **Hybrid**: ~300-700ms (combines multiple strategies)

### Scalability
- Works well for datasets up to 100K items
- For larger datasets, consider:
  - Adding HNSW indexes for faster vector search
  - Caching frequent recommendations
  - Using approximate nearest neighbor search

### Optimization Tips
1. **Cache recommendations** for frequently accessed items
2. **Pre-compute** recommendations for popular items
3. **Batch requests** when possible (multi-item is more efficient than multiple item-based calls)
4. **Use appropriate limits** - don't request more than needed

## Troubleshooting

### Issue: No Recommendations Returned

**Possible Causes:**
1. Source items don't have embeddings
2. Similarity threshold too high
3. Not enough similar items in database

**Solutions:**
- Check if items have embeddings: `GET /api/media/stats/embeddings`
- Lower `minSimilarity` threshold
- The system automatically lowers thresholds, but you can set it manually
- Add more related content to your database

### Issue: Recommendations Not Relevant

**Possible Causes:**
1. Similarity threshold too low
2. Content not semantically related
3. Embeddings not generated properly

**Solutions:**
- Increase `minSimilarity` to 0.5-0.7
- Verify embeddings are generated correctly
- Check that content is semantically related
- Use hybrid recommendations with adjusted weights

### Issue: Same Items Always Recommended

**Possible Causes:**
1. Limited content in database
2. Not excluding already-seen items
3. Similarity scores too similar

**Solutions:**
- Use `excludeIds` to exclude already-seen items
- Add more diverse content to database
- Consider using hybrid recommendations for diversity
- Sort by different criteria (e.g., recency) in addition to similarity

## Integration Examples

### Frontend Integration (JavaScript)

```javascript
// Item-based recommendations
async function getRecommendations(itemId) {
  const response = await fetch(
    `/api/media/recommendations/item/${itemId}?limit=5`
  );
  const data = await response.json();
  return data.recommendations;
}

// Multi-item recommendations
async function getPersonalizedRecommendations(userLikedItems) {
  const response = await fetch('/api/media/recommendations/multi-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemIds: userLikedItems,
      limit: 10,
      minSimilarity: 0.4
    })
  });
  const data = await response.json();
  return data.recommendations;
}

// Content-based recommendations
async function exploreTopic(query) {
  const response = await fetch('/api/media/recommendations/content-based', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: query,
      limit: 10
    })
  });
  const data = await response.json();
  return data.recommendations;
}
```

### React Component Example

```jsx
import { useState, useEffect } from 'react';

function Recommendations({ itemId }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const response = await fetch(
          `/api/media/recommendations/item/${itemId}?limit=5`
        );
        const data = await response.json();
        setRecommendations(data.recommendations);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      } finally {
        setLoading(false);
      }
    }

    if (itemId) {
      fetchRecommendations();
    }
  }, [itemId]);

  if (loading) return <div>Loading recommendations...</div>;

  return (
    <div>
      <h3>Recommended for You</h3>
      {recommendations.map((rec) => (
        <div key={rec.item.id}>
          <h4>{rec.item.title}</h4>
          <p>Similarity: {(rec.similarity * 100).toFixed(1)}%</p>
          <p>{rec.reason}</p>
        </div>
      ))}
    </div>
  );
}
```

## Summary

The recommendation system provides:

✅ **Multiple Strategies**: Item-based, multi-item, content-based, and hybrid  
✅ **Semantic Understanding**: Uses vector embeddings for meaning-based recommendations  
✅ **Flexible Configuration**: Adjustable similarity thresholds, limits, and weights  
✅ **Automatic Optimization**: Progressive threshold lowering for better coverage  
✅ **Rich Metadata**: Detailed information about recommendation quality  
✅ **Easy Integration**: Simple REST API with clear response format  

**Use recommendations when:**
- Building "more like this" features
- Creating personalized content feeds
- Implementing discovery features
- Providing related content suggestions
- Building user preference-based systems

---

**Last Updated:** 2024  
**Implementation:** VectorDB-POC  
**Embedding Model:** Google Gemini text-embedding-004  
**Similarity Metric:** Cosine Distance

