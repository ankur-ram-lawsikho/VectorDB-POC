# Similarity Search Guide

A comprehensive guide to understanding similarity search, distance metrics, and how to choose the right one for your use case.

## Table of Contents

1. [What is Similarity Search?](#what-is-similarity-search)
2. [How Vector Similarity Works](#how-vector-similarity-works)
3. [Distance Metrics Overview](#distance-metrics-overview)
4. [Cosine Distance](#cosine-distance)
5. [Euclidean (L2) Distance](#euclidean-l2-distance)
6. [Inner Product](#inner-product)
7. [Comparing the Metrics](#comparing-the-metrics)
8. [Choosing the Right Metric](#choosing-the-right-metric)
9. [Implementation in This Project](#implementation-in-this-project)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## What is Similarity Search?

Similarity search is a technique for finding items in a database that are "similar" to a given query, even if they don't contain the exact same words or features. Instead of exact matching, it uses mathematical distance calculations to measure how similar items are in a high-dimensional vector space.

### Key Concepts

- **Embeddings**: Text, images, or other data converted into numerical vectors
- **Vector Space**: A multi-dimensional space where similar items are positioned close together
- **Distance Metrics**: Mathematical formulas that measure how "far apart" two vectors are
- **Semantic Understanding**: Finds conceptually similar items, not just keyword matches

### Example

If you search for "database management system", similarity search can find:
- ✅ "MongoDB tutorial" (related concept)
- ✅ "SQL queries guide" (related concept)
- ✅ "NoSQL databases" (related concept)
- ❌ "Cooking recipes" (unrelated - won't appear)

---

## How Vector Similarity Works

### Step 1: Convert to Vectors

Text, images, or other data is converted into numerical vectors (arrays of numbers):

```
"Database tutorial" → [0.123, -0.456, 0.789, ..., 0.234] (768 numbers)
```

### Step 2: Store in Vector Space

All items are positioned in a high-dimensional space based on their embeddings:

```
Item A: [0.1, 0.2, 0.3, ...]
Item B: [0.15, 0.25, 0.35, ...]  ← Close to A (similar)
Item C: [0.9, 0.8, 0.7, ...]    ← Far from A (different)
```

### Step 3: Calculate Distance

When you search, the system:
1. Converts your query to a vector
2. Calculates distance to all stored vectors
3. Returns items with smallest distances (most similar)

### Step 4: Filter and Rank

Results are filtered by a distance threshold and ranked by similarity.

---

## Distance Metrics Overview

pgvector supports three distance operators, each measuring similarity differently:

| Metric | Operator | Range | Best For |
|--------|----------|-------|----------|
| **Cosine Distance** | `<=>` | 0 to 2 | Text embeddings, semantic search |
| **Euclidean (L2)** | `<->` | 0 to ∞ | Spatial data, normalized vectors |
| **Inner Product** | `<#>` | -∞ to ∞ | Large-scale search, specific use cases |

---

## Cosine Distance

### How It Works

Cosine distance measures the **angle** between two vectors, ignoring their magnitude (length).

**Formula:**
```
distance = 1 - cosine_similarity
cosine_similarity = (A · B) / (||A|| × ||B||)
```

**pgvector Operator:** `<=>`

### Characteristics

- **Range**: 0 (identical) to 2 (opposite)
- **Normalized**: Works well with vectors of different magnitudes
- **Direction-focused**: Measures similarity in direction, not magnitude

### Visual Representation

```
Vector A:  →→→→→
Vector B:  →→→→→  (same direction) → Distance: 0.0 (identical)
Vector C:  ↑↑↑↑↑  (perpendicular) → Distance: 1.0 (orthogonal)
Vector D:  ←←←←←  (opposite)      → Distance: 2.0 (opposite)
```

### Strengths ✅

1. **Best for Text Embeddings**
   - Designed for semantic similarity
   - Works excellently with word embeddings and transformer models
   - Most commonly used in NLP applications

2. **Magnitude Invariant**
   - Ignores vector length, focuses on direction
   - Handles vectors of different scales well
   - Robust to normalization issues

3. **Intuitive Range**
   - 0 = identical
   - 1 = orthogonal (unrelated)
   - 2 = opposite
   - Easy to interpret and set thresholds

4. **Widely Supported**
   - Default choice for most similarity search systems
   - Extensive documentation and examples
   - Well-optimized in pgvector

### Weaknesses ❌

1. **Not Ideal for Magnitude-Sensitive Data**
   - Ignores vector magnitude completely
   - May not work well if magnitude carries important information
   - Example: If "importance" is encoded in magnitude, cosine loses that

2. **Computational Overhead**
   - Slightly more expensive than inner product
   - Requires normalization calculations
   - Still very fast, but not the fastest

3. **Limited for Non-Normalized Vectors**
   - Works best with normalized embeddings
   - May give unexpected results with unnormalized vectors
   - Most modern embedding models normalize by default

### When to Use Cosine Distance

✅ **Use when:**
- Working with text embeddings (most common case)
- Semantic search applications
- Vectors are normalized or magnitude doesn't matter
- You want the most intuitive similarity measure
- Building general-purpose similarity search

❌ **Avoid when:**
- Vector magnitude carries important information
- Working with unnormalized vectors where magnitude matters
- Need maximum performance (use inner product instead)

### Recommended Thresholds

- **Strict (0.1-0.3)**: Only very similar results
- **Moderate (0.3-0.7)**: Related results (recommended default: **0.5**)
- **Permissive (0.7-1.0)**: Somewhat related results
- **Very Permissive (1.0-2.0)**: All results, even loosely related

### Example

```sql
-- Find items similar to a query vector
SELECT * FROM media_items
WHERE embedding IS NOT NULL
  AND embedding::vector <=> '[0.123, -0.456, ...]'::vector <= 0.5
ORDER BY embedding::vector <=> '[0.123, -0.456, ...]'::vector ASC
LIMIT 10;
```

---

## Euclidean (L2) Distance

### How It Works

Euclidean distance measures the **straight-line distance** between two points in vector space.

**Formula:**
```
distance = √[(a₁-b₁)² + (a₂-b₂)² + ... + (aₙ-bₙ)²]
```

**pgvector Operator:** `<->`

### Characteristics

- **Range**: 0 (identical) to infinity
- **Magnitude-sensitive**: Considers both direction and magnitude
- **Geometric**: Measures actual distance in space

### Visual Representation

```
Point A: (0, 0)
Point B: (3, 4)  → Distance: 5.0 (Pythagorean: √(3²+4²))
Point C: (1, 1)  → Distance: 1.41 (closer to A)
```

### Strengths ✅

1. **Intuitive Geometric Interpretation**
   - Measures actual "distance" in space
   - Easy to visualize and understand
   - Familiar from geometry and physics

2. **Magnitude-Aware**
   - Considers both direction and magnitude
   - Useful when vector magnitude carries information
   - Better for some types of data (e.g., feature vectors)

3. **Good for Normalized Vectors**
   - Works well when all vectors are normalized
   - Can be equivalent to cosine for normalized vectors
   - Stable and predictable

4. **Spatial Applications**
   - Excellent for geographic/spatial data
   - Good for feature-based similarity
   - Natural fit for coordinate-based data

### Weaknesses ❌

1. **Sensitive to Vector Magnitude**
   - Large vectors dominate distance calculations
   - Can give misleading results with unnormalized vectors
   - Requires careful normalization

2. **Scale-Dependent**
   - Results depend on the scale of your vectors
   - Different scales can produce very different rankings
   - May need feature scaling/normalization

3. **Less Common for Text**
   - Not the default choice for text embeddings
   - Cosine is generally preferred for semantic search
   - Less documentation/examples for text use cases

4. **Unbounded Range**
   - Range is 0 to infinity (not bounded)
   - Harder to set universal thresholds
   - Threshold values depend on your data scale

### When to Use Euclidean (L2) Distance

✅ **Use when:**
- Working with normalized vectors where magnitude matters
- Spatial/geographic data
- Feature vectors where magnitude is meaningful
- You need geometric distance interpretation
- Vectors are on similar scales

❌ **Avoid when:**
- Working with unnormalized text embeddings
- Vectors have very different magnitudes
- Building general semantic search (use cosine)
- Need bounded, interpretable range

### Recommended Thresholds

Thresholds depend heavily on your data scale. For normalized 768-dimensional embeddings:

- **Strict (0.1-0.5)**: Very similar results
- **Moderate (0.5-1.0)**: Related results (recommended default: **1.0**)
- **Permissive (1.0-2.0)**: Somewhat related
- **Very Permissive (2.0+)**: Loosely related

**Note:** Thresholds are data-dependent. Start with 1.0 and adjust based on your results.

### Example

```sql
-- Find items using Euclidean distance
SELECT * FROM media_items
WHERE embedding IS NOT NULL
  AND embedding::vector <-> '[0.123, -0.456, ...]'::vector <= 1.0
ORDER BY embedding::vector <-> '[0.123, -0.456, ...]'::vector ASC
LIMIT 10;
```

---

## Inner Product

### How It Works

Inner product (dot product) measures the product of vector magnitudes and the cosine of the angle between them.

**Formula:**
```
inner_product = A · B = Σ(aᵢ × bᵢ)
pgvector <#> = -1 × inner_product
```

**pgvector Operator:** `<#>` (returns negative inner product)

### Characteristics

- **Range**: -∞ to ∞ (typically -1 to 1 for normalized vectors)
- **Magnitude-sensitive**: Considers both direction and magnitude
- **Lower is better**: Smaller `<#>` values = more similar

### Visual Representation

For normalized vectors:
- **-1**: Vectors point in same direction (most similar)
- **0**: Vectors are orthogonal (unrelated)
- **1**: Vectors point in opposite directions (most different)

### Strengths ✅

1. **Computational Efficiency**
   - Fastest to compute (simple dot product)
   - No square root or normalization needed
   - Best for large-scale applications

2. **Magnitude-Aware**
   - Considers both direction and magnitude
   - Useful when magnitude carries information
   - Can capture importance if encoded in magnitude

3. **Good for Large-Scale Search**
   - Optimized for performance
   - Used in production systems requiring speed
   - Efficient for billions of vectors

4. **Specific Use Cases**
   - Works well with certain embedding models
   - Good for recommendation systems
   - Useful when vectors aren't normalized

### Weaknesses ❌

1. **Magnitude-Dependent**
   - Results heavily influenced by vector magnitudes
   - Can give misleading results with unnormalized vectors
   - Requires careful handling of vector scales

2. **Less Intuitive**
   - Negative values can be confusing
   - "Lower is better" is counterintuitive
   - Harder to interpret than cosine/Euclidean

3. **Not Ideal for Text Embeddings**
   - Cosine is generally preferred for semantic search
   - Less commonly used in NLP applications
   - May not capture semantic similarity as well

4. **Threshold Setting Challenges**
   - Range is unbounded and data-dependent
   - Hard to set universal thresholds
   - Requires experimentation with your specific data

5. **Sensitive to Normalization**
   - Works best with normalized vectors
   - Unnormalized vectors can produce unexpected results
   - May need preprocessing

### When to Use Inner Product

✅ **Use when:**
- Performance is critical (large-scale search)
- Vectors are normalized and magnitude matters
- Building recommendation systems
- Working with specific embedding models that work well with inner product
- You have performance requirements that outweigh interpretability

❌ **Avoid when:**
- Building general semantic search (use cosine)
- Need intuitive, interpretable results
- Working with unnormalized text embeddings
- Want bounded, easy-to-set thresholds
- Building applications where explainability matters

### Recommended Thresholds

For normalized 768-dimensional embeddings:

- **Strict (-1.0 to -0.5)**: Very similar results
- **Moderate (-0.5 to 0.0)**: Related results (recommended default: **0.5**)
- **Permissive (0.0 to 0.5)**: Somewhat related
- **Very Permissive (0.5 to 1.0)**: Loosely related

**Note:** Since `<#>` returns negative inner product, lower values are more similar. A threshold of 0.5 means accepting items with `<#>` ≤ 0.5.

### Example

```sql
-- Find items using inner product
SELECT * FROM media_items
WHERE embedding IS NOT NULL
  AND embedding::vector <#> '[0.123, -0.456, ...]'::vector <= 0.5
ORDER BY embedding::vector <#> '[0.123, -0.456, ...]'::vector ASC
LIMIT 10;
```

---

## Comparing the Metrics

### Quick Comparison Table

| Aspect | Cosine | Euclidean (L2) | Inner Product |
|--------|--------|----------------|---------------|
| **Best For** | Text embeddings | Spatial data | Large-scale search |
| **Range** | 0-2 (bounded) | 0-∞ (unbounded) | -∞ to ∞ (unbounded) |
| **Magnitude** | Ignores | Considers | Considers |
| **Speed** | Fast | Fast | Fastest |
| **Intuitiveness** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Text Search** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Interpretability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Threshold Setting** | Easy | Moderate | Hard |

### Detailed Comparison

#### 1. **Interpretability**

**Cosine:** ⭐⭐⭐⭐⭐
- Clear, bounded range (0-2)
- Intuitive meaning: 0=identical, 1=orthogonal, 2=opposite
- Easy to explain to non-technical users

**Euclidean:** ⭐⭐⭐⭐
- Geometric interpretation is intuitive
- Range is unbounded, making thresholds data-dependent
- Still relatively easy to understand

**Inner Product:** ⭐⭐⭐
- Negative values can be confusing
- "Lower is better" is counterintuitive
- Requires understanding of vector mathematics

#### 2. **Performance**

**Inner Product:** ⭐⭐⭐⭐⭐
- Fastest computation (simple dot product)
- No square root or normalization
- Best for large-scale systems

**Cosine:** ⭐⭐⭐⭐
- Fast, but requires normalization
- Well-optimized in pgvector
- Good performance for most use cases

**Euclidean:** ⭐⭐⭐⭐
- Fast, but requires square root
- Similar performance to cosine
- Good for most applications

#### 3. **Text Embedding Suitability**

**Cosine:** ⭐⭐⭐⭐⭐
- Designed for semantic similarity
- Industry standard for text search
- Works excellently with transformer models

**Euclidean:** ⭐⭐⭐
- Works but not optimal
- Better for normalized vectors
- Less common in NLP

**Inner Product:** ⭐⭐
- Not ideal for text embeddings
- May not capture semantic similarity well
- Rarely used in text search

#### 4. **Threshold Setting**

**Cosine:** ⭐⭐⭐⭐⭐
- Bounded range makes thresholds universal
- Well-documented thresholds (0.3-0.7 typical)
- Easy to set and tune

**Euclidean:** ⭐⭐⭐
- Unbounded range requires data-specific thresholds
- Depends on vector scale
- Requires experimentation

**Inner Product:** ⭐⭐
- Unbounded, data-dependent range
- Negative values complicate threshold setting
- Requires significant experimentation

---

## Choosing the Right Metric

### Decision Tree

```
Start
  │
  ├─ Is this for text/semantic search?
  │   │
  │   ├─ YES → Use Cosine Distance ⭐ (Recommended)
  │   │
  │   └─ NO → Continue
  │
  ├─ Is this spatial/geographic data?
  │   │
  │   ├─ YES → Use Euclidean (L2) Distance
  │   │
  │   └─ NO → Continue
  │
  ├─ Is performance critical (billions of vectors)?
  │   │
  │   ├─ YES → Consider Inner Product
  │   │         (if vectors are normalized)
  │   │
  │   └─ NO → Continue
  │
  └─ Are vectors normalized?
      │
      ├─ YES → Cosine or Euclidean (both work well)
      │
      └─ NO → Normalize first, then use Cosine
```

### Use Case Recommendations

#### **Text/Semantic Search** → Cosine Distance
- Most common use case
- Best for semantic understanding
- Industry standard
- **This project uses Cosine as default**

#### **Spatial/Geographic Data** → Euclidean (L2)
- Natural fit for coordinates
- Intuitive distance interpretation
- Good for location-based search

#### **Large-Scale Production** → Inner Product
- When performance is critical
- Billions of vectors
- Vectors are normalized
- Speed outweighs interpretability

#### **Feature Vectors** → Euclidean or Cosine
- Depends on whether magnitude matters
- If magnitude matters: Euclidean
- If only direction matters: Cosine

#### **Recommendation Systems** → Inner Product or Cosine
- Inner product if performance critical
- Cosine if interpretability matters
- Depends on specific requirements

---

## Implementation in This Project

### Current Setup

This project uses **Google Gemini's `text-embedding-004`** model, which produces:
- **768-dimensional vectors**
- **Normalized embeddings** (suitable for all three metrics)
- **Optimized for semantic search**

### Default Configuration

```typescript
// Default metric: Cosine
const defaultMetric = 'cosine';

// Default thresholds
const thresholds = {
  cosine: 0.5,        // Moderate similarity
  l2: 1.0,           // Moderate distance
  inner_product: 0.5 // Moderate (lower = more similar)
};
```

### API Usage

#### Search with Cosine (Default)
```bash
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database tutorial",
    "limit": 10,
    "metric": "cosine",
    "maxDistance": 0.5
  }'
```

#### Search with Euclidean
```bash
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database tutorial",
    "limit": 10,
    "metric": "l2",
    "maxDistance": 1.0
  }'
```

#### Search with Inner Product
```bash
curl -X POST http://localhost:3000/api/media/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database tutorial",
    "limit": 10,
    "metric": "inner_product",
    "maxDistance": 0.5
  }'
```

### SQL Implementation

All three metrics use the same pattern in PostgreSQL:

```sql
-- Cosine
SELECT * FROM media_items
WHERE embedding::vector <=> query_vector <= threshold
ORDER BY embedding::vector <=> query_vector ASC;

-- Euclidean
SELECT * FROM media_items
WHERE embedding::vector <-> query_vector <= threshold
ORDER BY embedding::vector <-> query_vector ASC;

-- Inner Product
SELECT * FROM media_items
WHERE embedding::vector <#> query_vector <= threshold
ORDER BY embedding::vector <#> query_vector ASC;
```

---

## Best Practices

### 1. **Start with Cosine**

For most applications, especially text search:
- ✅ Start with cosine distance
- ✅ Use default threshold (0.5)
- ✅ Tune based on results

### 2. **Understand Your Data**

Before choosing a metric:
- Check if vectors are normalized
- Understand what magnitude means in your data
- Test with sample queries

### 3. **Set Appropriate Thresholds**

**Cosine:**
- Start with 0.5 (moderate)
- Increase to 0.7-1.0 if too few results
- Decrease to 0.3 if too many irrelevant results

**Euclidean:**
- Start with 1.0
- Adjust based on your data scale
- Monitor distance distributions

**Inner Product:**
- Start with 0.5
- Remember: lower = more similar
- May need negative thresholds for strict matching

### 4. **Test Multiple Metrics**

For your specific use case:
1. Test all three metrics
2. Compare result quality
3. Consider performance requirements
4. Choose based on results, not assumptions

### 5. **Monitor Distance Distributions**

Track the distribution of distances:
- Most results clustered around a value?
- Wide spread or narrow?
- Adjust thresholds based on distribution

### 6. **Use Indexes**

pgvector supports indexes for all three metrics:
```sql
-- HNSW index for cosine
CREATE INDEX ON media_items USING hnsw (embedding vector_cosine_ops);

-- HNSW index for L2
CREATE INDEX ON media_items USING hnsw (embedding vector_l2_ops);

-- HNSW index for inner product
CREATE INDEX ON media_items USING hnsw (embedding vector_ip_ops);
```

### 7. **Normalize When Needed**

If using Euclidean or Inner Product:
- Ensure vectors are normalized
- Or normalize during query time
- Document normalization approach

---

## Troubleshooting

### Issue: Getting 0 Results

**Possible Causes:**
1. Threshold too strict
2. No items have embeddings
3. No semantically similar content exists

**Solutions:**
- Increase threshold (try 1.0-2.0)
- Check embedding stats: `GET /api/media/stats/embeddings`
- Verify items have embeddings
- Create test items with related content

### Issue: Too Many Results

**Possible Causes:**
1. Threshold too permissive
2. Many items are actually similar

**Solutions:**
- Decrease threshold
- Use stricter filtering
- Add additional filters (e.g., by type, date)

### Issue: Inner Product Showing All Results

**Possible Causes:**
1. Threshold too high (was 10.0, now fixed to 0.5)
2. Vectors not normalized

**Solutions:**
- Use threshold 0.0 to 0.5 for normalized vectors
- Ensure vectors are normalized
- Consider using cosine instead

### Issue: Results Don't Make Sense

**Possible Causes:**
1. Wrong metric for your data type
2. Vectors not properly normalized
3. Threshold inappropriate

**Solutions:**
- Try a different metric
- Verify vector normalization
- Adjust threshold
- Check embedding generation

### Issue: Performance Problems

**Possible Causes:**
1. No index on embedding column
2. Too many results being processed
3. Inefficient queries

**Solutions:**
- Create appropriate HNSW index
- Reduce result limit
- Optimize query structure
- Consider using inner product for speed

---

## Summary

### Quick Reference

| Metric | Use When | Default Threshold | Best For |
|--------|----------|-------------------|----------|
| **Cosine** | Text search, semantic similarity | 0.5 | ⭐ Most use cases |
| **Euclidean** | Spatial data, magnitude matters | 1.0 | Geographic/spatial |
| **Inner Product** | Large-scale, performance critical | 0.5 | Production systems |

### Key Takeaways

1. **Cosine is the default choice** for text/semantic search
2. **Euclidean** is good for spatial data and when magnitude matters
3. **Inner Product** is fastest but less intuitive
4. **Thresholds matter** - tune based on your data
5. **Test multiple metrics** to find what works best for your use case

### Recommended Approach

1. Start with **Cosine** distance (threshold: 0.5)
2. Test with your data
3. If results are poor, try **Euclidean** (threshold: 1.0)
4. If performance is critical, consider **Inner Product** (threshold: 0.5)
5. Tune thresholds based on result quality
6. Document your choice and reasoning

---

## Additional Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Vector Similarity Search Explained](https://www.pinecone.io/learn/vector-similarity/)
- [Choosing the Right Distance Metric](https://towardsdatascience.com/9-distance-metrics-in-data-science-with-python-code-1e02cdb4d13a)
- [This Project's pgvector Concepts](./PGVECTOR_CONCEPTS.md)

---

**Last Updated:** 2024
**Project:** VectorDB-POC
**Embedding Model:** Google Gemini text-embedding-004 (768 dimensions)

