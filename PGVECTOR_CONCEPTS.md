# pgvector Concepts and Principles Used in This Project

## Table of Contents
1. [What is pgvector?](#what-is-pgvector)
2. [Core Concepts](#core-concepts)
3. [Vector Embeddings](#vector-embeddings)
4. [Similarity Search](#similarity-search)
5. [Implementation in This Project](#implementation-in-this-project)
6. [Key Operators Used](#key-operators-used)
7. [Best Practices](#best-practices)

---

## What is pgvector?

**pgvector** is a PostgreSQL extension that adds support for storing and querying vector embeddings. It enables efficient similarity search directly in your database, making it perfect for:

- Semantic search
- Recommendation systems
- Image similarity search
- Natural language processing applications
- Machine learning applications

### Why pgvector?

Instead of using external vector databases (like Pinecone, Weaviate, or Qdrant), pgvector allows you to:
- Store vectors alongside your relational data
- Perform similarity searches using SQL
- Maintain data consistency with ACID transactions
- Reduce infrastructure complexity

---

## Core Concepts

### 1. Vector Data Type

pgvector introduces a new PostgreSQL data type called `vector` that stores high-dimensional vectors (arrays of floating-point numbers).

**Syntax:**
```sql
vector(dimensions)
```

**Example:**
```sql
-- 768-dimensional vector (used in this project for Gemini embeddings)
vector(768)
```

### 2. Vector Storage

Vectors are stored as arrays of floating-point numbers. In this project:
- **Dimension**: 768 (Gemini `text-embedding-004` model produces 768-dimensional vectors)
- **Storage**: Stored as `vector(768)` type in PostgreSQL
- **Format**: Arrays like `[0.123, -0.456, 0.789, ...]` (768 numbers)

---

## Vector Embeddings

### What are Embeddings?

**Embeddings** are numerical representations of text, images, or other data in a high-dimensional space. Similar concepts are positioned close together in this space.

### How Embeddings Work

1. **Text Input**: "MongoDB tutorial"
2. **Embedding Model**: Gemini `text-embedding-004`
3. **Output**: A 768-dimensional vector like `[0.123, -0.456, 0.789, ...]`

### Embedding Generation in This Project

```typescript
// Text is converted to embedding
const text = "MongoDB tutorial";
const embedding = await generateEmbedding(text);
// Result: [0.123, -0.456, 0.789, ...] (768 numbers)
```

**Key Properties:**
- **Semantic Similarity**: Similar texts produce similar vectors
- **Distance = Similarity**: Closer vectors = more similar content
- **Fixed Dimension**: All embeddings have the same dimension (768)

---

## Similarity Search

### Concept

Similarity search finds items whose embeddings are "close" to a query embedding in the vector space.

### Distance Metrics

pgvector supports three distance operators:

#### 1. **Cosine Distance** (`<=>`)
- Measures the angle between two vectors
- Range: 0 (identical) to 2 (opposite)
- **Used in this project**
- Best for text embeddings

#### 2. **Euclidean Distance** (`<->`)
- Measures straight-line distance
- Range: 0 to infinity
- Good for spatial data

#### 3. **Inner Product** (`<#>`)
- Measures dot product
- Can be negative
- Less commonly used

### Why Cosine Distance?

In this project, we use **cosine distance** (`<=>`) because:
- It's ideal for text embeddings
- Normalizes for vector magnitude
- Focuses on direction (semantic meaning) rather than magnitude
- Works well with word embeddings and semantic search

**Example:**
```sql
-- Find items similar to a query
SELECT * FROM media_items
ORDER BY embedding::vector <=> '[0.123, -0.456, ...]'::vector
LIMIT 10;
```

---

## Implementation in This Project

### 1. Database Setup

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table with vector column
CREATE TABLE media_items (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  embedding vector(768)  -- 768 dimensions for Gemini embeddings
);
```

### 2. Storing Embeddings

**Process:**
1. Generate embedding from text (title + description + content)
2. Convert to PostgreSQL vector format: `[1,2,3,...]`
3. Store in database

```typescript
// Generate embedding
const embeddingArray = await generateEmbedding(text);
const embeddingString = `[${embeddingArray.join(',')}]`;

// Store in database
await query(
  `UPDATE media_items SET embedding = $1::vector(768) WHERE id = $2`,
  [embeddingString, itemId]
);
```

### 3. Similarity Search Query

**Current Implementation:**
```sql
SELECT 
  id, title, type, content, description, "filePath", url, "mimeType", 
  embedding, "createdAt", "updatedAt",
  (embedding::vector <=> $1::vector) as distance
FROM media_items
WHERE embedding IS NOT NULL
  AND embedding::vector <=> $1::vector <= $2  -- maxDistance threshold
ORDER BY embedding::vector <=> $1::vector ASC  -- Lower distance = more similar
LIMIT $3
```

**Key Components:**
- `embedding::vector <=> $1::vector`: Calculates cosine distance
- `<= $2`: Filters results by maximum distance (0.5 in this project)
- `ORDER BY ... ASC`: Sorts by similarity (closest first)
- `LIMIT $3`: Returns top N results

### 4. Distance Threshold

**Purpose**: Filter out irrelevant results

**Current Setting**: `maxDistance = 0.5`

**Meaning:**
- Distance < 0.5: Very similar (returned)
- Distance 0.5-1.0: Somewhat similar (returned)
- Distance > 1.0: Not similar (filtered out)

**Cosine Distance Guide:**
- **0.0**: Identical vectors
- **0.0-0.3**: Very similar (same topic)
- **0.3-0.7**: Related (similar concepts)
- **0.7-1.0**: Somewhat related
- **1.0-2.0**: Unrelated or opposite

---

## Key Operators Used

### 1. Cosine Distance Operator (`<=>`)

**Syntax:**
```sql
vector1 <=> vector2
```

**Returns**: Distance value (0 to 2)

**Usage in Project:**
```sql
-- Calculate distance
embedding::vector <=> query_vector::vector

-- Order by similarity
ORDER BY embedding::vector <=> query_vector::vector ASC

-- Filter by threshold
WHERE embedding::vector <=> query_vector::vector <= 0.5
```

### 2. Type Casting (`::vector`)

**Purpose**: Convert text/array to vector type

**Usage:**
```sql
-- Cast string to vector
'[1,2,3,...]'::vector(768)

-- Cast column to vector (if stored as text)
embedding::vector
```

---

## Best Practices Used in This Project

### 1. **Fixed Vector Dimension**
- All embeddings use 768 dimensions (matching Gemini model)
- Ensures consistency and proper distance calculations

### 2. **Indexing** (Future Enhancement)
```sql
-- Create index for faster searches (not yet implemented)
CREATE INDEX ON media_items 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 3. **NULL Handling**
- Only items with embeddings are searchable
- `WHERE embedding IS NOT NULL` ensures valid searches

### 4. **Distance Threshold**
- Using `maxDistance = 0.5` filters irrelevant results
- Prevents returning completely unrelated items

### 5. **Embedding Generation**
- Generate embeddings from meaningful text (title + description + content)
- Ensures searchable content is semantically rich

---

## How Search Works in This Project

### Step-by-Step Process

1. **User enters search query**: "MongoDB"

2. **Generate query embedding**:
   ```typescript
   const queryEmbedding = await generateEmbedding("MongoDB");
   // Result: [0.123, -0.456, ...] (768 numbers)
   ```

3. **Convert to PostgreSQL format**:
   ```typescript
   const queryVector = `[${queryEmbedding.join(',')}]`;
   ```

4. **Execute similarity search**:
   ```sql
   SELECT * FROM media_items
   WHERE embedding IS NOT NULL
   ORDER BY embedding::vector <=> '[0.123, -0.456, ...]'::vector ASC
   LIMIT 10
   ```

5. **Results returned by similarity**:
   - Most similar items first (lowest distance)
   - Only items within threshold (distance <= 0.5)
   - Limited to top 10 results

### Example Scenario

**Database has:**
- Item 1: "MongoDB Tutorial" → embedding: `[0.1, 0.2, ...]`
- Item 2: "React Guide" → embedding: `[0.9, 0.8, ...]`
- Item 3: "MongoDB Basics" → embedding: `[0.12, 0.18, ...]`

**User searches: "MongoDB"**
- Query embedding: `[0.11, 0.19, ...]`

**Results (ordered by distance):**
1. "MongoDB Basics" (distance: 0.05) ✓
2. "MongoDB Tutorial" (distance: 0.08) ✓
3. "React Guide" (distance: 1.2) ✗ (filtered out, > 0.5)

---

## Technical Details

### Vector Storage Format

**In Database:**
- Type: `vector(768)`
- Stored as: Binary format (efficient)
- Can be cast from: Text format `'[1,2,3,...]'`

**In Application:**
- Generated as: `number[]` (TypeScript array)
- Converted to: String `"[1,2,3,...]"`
- Stored via: SQL UPDATE with casting

### Performance Considerations

**Current Implementation:**
- Linear search (scans all rows)
- Works well for small to medium datasets (< 100K items)

**Future Optimization:**
- Add `ivfflat` index for faster searches
- Use approximate nearest neighbor (ANN) search
- Scale to millions of vectors

---

## Summary

### Key Concepts Used

1. **Vector Type**: `vector(768)` for storing embeddings
2. **Cosine Distance**: `<=>` operator for similarity measurement
3. **Similarity Search**: ORDER BY distance to find similar items
4. **Distance Threshold**: Filter irrelevant results
5. **Embedding Generation**: Convert text to vectors using Gemini API

### Why This Approach Works

- **Semantic Understanding**: Embeddings capture meaning, not just keywords
- **Flexible Search**: Finds related content even with different wording
- **Integrated**: Works seamlessly with PostgreSQL relational data
- **Scalable**: Can handle large datasets with proper indexing

---

## References

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [pgvector Documentation](https://github.com/pgvector/pgvector#documentation)
- [Google Gemini Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)
- [Vector Similarity Search](https://www.pinecone.io/learn/vector-similarity/)

---

## Project-Specific Implementation

### Files Using pgvector

1. **`src/entities/MediaItem.ts`**: Defines embedding column
2. **`src/services/mediaService.ts`**: Implements similarity search
3. **`src/utils/embeddings.ts`**: Generates embeddings
4. **`src/index.ts`**: Sets up pgvector extension
5. **`docker-compose.yml`**: Uses `pgvector/pgvector:pg16` image

### Database Schema

```sql
CREATE TABLE media_items (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  type VARCHAR(50),
  content TEXT,
  description TEXT,
  embedding vector(768),  -- pgvector column
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);
```

---

*This document explains the pgvector concepts and principles used in the VectorDB Media Library project.*

