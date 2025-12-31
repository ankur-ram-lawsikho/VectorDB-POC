# Fuzzy Search Guide

## Overview

Fuzzy Search is a typo-tolerant search feature that finds media items even when the search query contains spelling errors, typos, or partial matches. Unlike exact keyword matching, fuzzy search uses the **Levenshtein distance algorithm** to calculate similarity between strings, making it ideal for scenarios where users might not know the exact spelling or want to find similar content.

## Table of Contents

1. [What is Fuzzy Search?](#what-is-fuzzy-search)
2. [How It Works](#how-it-works)
3. [Mathematical Foundation](#mathematical-foundation)
4. [Configuration](#configuration)
5. [API Usage](#api-usage)
6. [Frontend Usage](#frontend-usage)
7. [Examples](#examples)
8. [Best Practices](#best-practices)
9. [Performance Considerations](#performance-considerations)

---

## What is Fuzzy Search?

Fuzzy Search is designed to handle:
- **Typos**: "databse" → finds "database"
- **Partial matches**: "react" → finds "React", "reactjs", "reactive"
- **Misspellings**: "MongoDB" → finds "Mongo DB", "Mongodb"
- **Word variations**: "contract" → finds "contracts", "contractual"

Unlike semantic search (which understands meaning) or similarity search (which uses vector embeddings), fuzzy search works at the **character level**, making it perfect for finding items when you're unsure of exact spelling.

---

## How It Works

### Algorithm: Levenshtein Distance

Fuzzy search uses the **Levenshtein distance** (also known as edit distance) to measure how different two strings are. The distance is the minimum number of single-character edits (insertions, deletions, or substitutions) required to transform one string into another.

### Matching Process

1. **Query Normalization**: The search query is converted to lowercase and trimmed
2. **Field Search**: The system searches across configured fields (title, description, content)
3. **Word-by-Word Matching**: For multi-word queries, each word is matched against text words
4. **Score Calculation**: Each match receives a fuzzy similarity score (0-1)
5. **Threshold Filtering**: Only results above the minimum score threshold are returned
6. **Sorting**: Results are sorted by fuzzy score (highest first)

### Matching Strategies

The fuzzy search uses multiple matching strategies:

1. **Exact Substring Match**: If the query appears exactly in the text → Score: 1.0
2. **Prefix Match**: If a word starts with the query → Score: 0.9
3. **Fuzzy Similarity**: Calculated using Levenshtein distance → Score: 0.0 to 1.0

The best score from all strategies is used for each field.

---

## Mathematical Foundation

### Levenshtein Distance Formula

The Levenshtein distance between two strings `s1` and `s2` is calculated using dynamic programming:

```
lev(s1, s2) = {
  0,                                    if |s1| = 0 and |s2| = 0
  |s1|,                                 if |s2| = 0
  |s2|,                                 if |s1| = 0
  lev(s1[1:], s2[1:]),                 if s1[0] = s2[0]
  min(
    lev(s1[1:], s2) + 1,                (deletion)
    lev(s1, s2[1:]) + 1,                (insertion)
    lev(s1[1:], s2[1:]) + 1             (substitution)
  ),                                    otherwise
}
```

### Fuzzy Similarity Score

The fuzzy similarity score converts the distance into a normalized similarity value:

```
similarity = 1 - (distance / max(length(s1), length(s2)))
```

**Example:**
- Query: "react" (5 characters)
- Text: "reactive" (8 characters)
- Distance: 3 (need to add "ive")
- Similarity: 1 - (3 / 8) = 0.625 (62.5%)

### Multi-Word Query Scoring

For queries with multiple words, the system:
1. Matches each query word against all text words
2. Takes the best match score for each query word
3. Calculates the average of all query word scores

```
final_score = (sum of best_match_scores) / (number of query_words)
```

---

## Configuration

Fuzzy search settings are defined in `src/config/vectordb.settings.ts`:

```typescript
export const FuzzySearchSettings = {
  /**
   * Default minimum fuzzy match score (0-1)
   * Lower = more permissive (finds more results with typos)
   * Higher = more strict (only close matches)
   */
  DEFAULT_MIN_SCORE: 0.3,

  /**
   * Strict fuzzy match threshold
   * Only very close matches
   */
  STRICT_MIN_SCORE: 0.7,

  /**
   * Moderate fuzzy match threshold
   * Balanced between typo tolerance and relevance
   */
  MODERATE_MIN_SCORE: 0.5,

  /**
   * Permissive fuzzy match threshold
   * Very tolerant of typos
   */
  PERMISSIVE_MIN_SCORE: 0.2,

  /**
   * Default fields to search in
   */
  DEFAULT_SEARCH_FIELDS: ['title', 'description', 'content'],

  /**
   * Default limit for fuzzy search results
   */
  DEFAULT_LIMIT: 20,
} as const;
```

### Adjusting Sensitivity

- **Strict (0.7)**: Only very close matches, fewer false positives
- **Moderate (0.5)**: Balanced, good for most use cases
- **Default (0.3)**: More permissive, finds items with more typos
- **Permissive (0.2)**: Very tolerant, may return less relevant results

---

## API Usage

### Endpoint

```
POST /api/media/search/fuzzy
```

### Request Body

```json
{
  "query": "react",
  "limit": 20,
  "minScore": 0.3,
  "searchFields": ["title", "description", "content"]
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query (can contain typos) |
| `limit` | number | No | 20 | Maximum number of results |
| `minScore` | number | No | 0.3 | Minimum fuzzy match score (0-1) |
| `searchFields` | array | No | ["title", "description", "content"] | Fields to search in |

### Response

```json
{
  "query": "react",
  "count": 5,
  "results": [
    {
      "id": "123",
      "title": "React Tutorial",
      "description": "Learn React.js",
      "content": "...",
      "type": "text",
      "fuzzyScore": 0.95,
      "matchedField": "title",
      "matchedText": "React Tutorial"
    }
  ],
  "metadata": {
    "searchType": "fuzzy",
    "averageScore": 0.87,
    "minScore": 0.65,
    "maxScore": 0.95
  }
}
```

### Response Fields

- `query`: The original search query
- `count`: Number of results returned
- `results`: Array of matching media items with:
  - `fuzzyScore`: Similarity score (0-1)
  - `matchedField`: Which field matched (title/description/content)
  - `matchedText`: The matched text snippet
- `metadata`: Search statistics

---

## Frontend Usage

### Using the UI

1. Navigate to the Search page
2. Select **"🔤 Fuzzy"** search mode
3. Enter your search query (can include typos)
4. Click "Search" or press Enter

### Visual Indicators

- **Fuzzy Badge**: Each result shows a pink badge with the fuzzy match score percentage
- **Matched Field**: Shows which field (title/description/content) matched
- **Match Preview**: Displays a snippet of the matched text

### Example Queries

- `"databse"` → Finds "database", "databases"
- `"MongoDB"` → Finds "Mongo DB", "Mongodb", "MongoDB Tutorial"
- `"contract law"` → Finds "Contract Law", "contracts", "legal contracts"
- `"react"` → Finds "React", "reactjs", "reactive", "React Native"

---

## Examples

### Example 1: Typo Tolerance

**Query:** `"databse"` (typo: missing 'a')

**Results:**
- "Database Management" (Score: 0.875)
- "Introduction to Databases" (Score: 0.857)
- "Database Design Patterns" (Score: 0.875)

**Calculation:**
- Distance: 1 (one substitution: 'a' → 'a')
- Similarity: 1 - (1 / 8) = 0.875

### Example 2: Partial Match

**Query:** `"react"`

**Results:**
- "React Tutorial" (Score: 1.0 - exact match)
- "React Native Guide" (Score: 0.833 - prefix match)
- "Reactive Programming" (Score: 0.625 - fuzzy match)

### Example 3: Multi-Word Query

**Query:** `"contract law"`

**Matching Process:**
1. "contract" matches "Contract" → Score: 1.0
2. "law" matches "Law" → Score: 1.0
3. Final Score: (1.0 + 1.0) / 2 = 1.0

**Results:**
- "Contract Law Basics" (Score: 1.0)
- "Legal Contracts Guide" (Score: 0.75 - "contract" matches, "law" doesn't)

---

## Best Practices

### When to Use Fuzzy Search

✅ **Good for:**
- User-facing search where typos are common
- Finding items when exact spelling is unknown
- Partial word matching
- Autocomplete/suggestion features

❌ **Not ideal for:**
- Very large datasets (performance impact)
- When exact matches are required
- Semantic understanding (use Semantic Search instead)
- Finding conceptually similar content (use Similarity Search instead)

### Query Tips

1. **Keep queries concise**: 1-3 words work best
2. **Use specific terms**: More specific queries yield better results
3. **Adjust minScore**: Lower for more results, higher for precision
4. **Combine with other searches**: Use fuzzy for typos, semantic for meaning

### Performance Optimization

1. **Limit search fields**: Only search in fields you need
2. **Set appropriate limits**: Don't request more results than needed
3. **Use caching**: Cache frequent queries
4. **Index frequently searched fields**: Consider database indexing for title/description

---

## Performance Considerations

### Time Complexity

- **Levenshtein Distance**: O(n × m) where n and m are string lengths
- **Word Matching**: O(w × t) where w is query words and t is text words
- **Overall**: O(n × m × items × fields)

### Optimization Strategies

1. **Early Termination**: Stop searching if exact match found (score = 1.0)
2. **Field Prioritization**: Search title first (usually shorter and more relevant)
3. **Threshold Filtering**: Filter low scores early
4. **Result Limiting**: Only process top N candidates

### Scalability

For large datasets (>10,000 items), consider:
- **Database-level fuzzy search**: Use PostgreSQL's `pg_trgm` extension
- **Indexing**: Create full-text search indexes
- **Caching**: Cache common queries
- **Pagination**: Implement result pagination

### Current Limitations

- Searches all items in memory (not database-indexed)
- Performance degrades with very large datasets
- No support for phonetic matching (e.g., "Smith" vs "Smyth")
- Case-insensitive only (no case-sensitive fuzzy matching)

---

## Comparison with Other Search Types

| Feature | Fuzzy Search | Keyword Search | Semantic Search | Similarity Search |
|---------|--------------|----------------|----------------|-------------------|
| **Typo Tolerance** | ✅ Excellent | ❌ None | ✅ Good | ✅ Good |
| **Meaning Understanding** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Partial Matches** | ✅ Yes | ⚠️ Limited | ✅ Yes | ✅ Yes |
| **Performance** | ⚠️ Moderate | ✅ Fast | ⚠️ Moderate | ✅ Fast |
| **Use Case** | Typos, spelling | Exact terms | Concepts, meaning | Vector similarity |

---

## Troubleshooting

### No Results Found

**Possible causes:**
1. **minScore too high**: Lower the threshold (try 0.2)
2. **Query too different**: Try a more similar query
3. **No matching content**: Database may not have related items

**Solutions:**
- Lower `minScore` to 0.2 or 0.1
- Try broader search terms
- Check if items exist in database

### Too Many Results

**Possible causes:**
1. **minScore too low**: Raise the threshold
2. **Query too generic**: Use more specific terms

**Solutions:**
- Increase `minScore` to 0.5 or 0.7
- Use more specific search terms
- Limit search to specific fields (e.g., only "title")

### Performance Issues

**Possible causes:**
1. **Large dataset**: Too many items to search
2. **Complex queries**: Multi-word queries take longer

**Solutions:**
- Reduce `limit` parameter
- Search only in specific fields
- Consider database-level fuzzy search for large datasets

---

## Advanced Usage

### Custom Field Search

Search only in specific fields:

```typescript
// Search only in titles
const results = await mediaService.fuzzySearch(
  "react",
  20,
  0.3,
  ['title']
);
```

### Adjusting Sensitivity

```typescript
// Very strict (only close matches)
const strictResults = await mediaService.fuzzySearch(
  "react",
  20,
  FuzzySearchSettings.STRICT_MIN_SCORE
);

// Very permissive (tolerant of typos)
const permissiveResults = await mediaService.fuzzySearch(
  "react",
  20,
  FuzzySearchSettings.PERMISSIVE_MIN_SCORE
);
```

---

## Summary

Fuzzy Search provides typo-tolerant search capabilities using the Levenshtein distance algorithm. It's ideal for:

- ✅ Finding items with spelling errors
- ✅ Partial word matching
- ✅ User-facing search interfaces
- ✅ Autocomplete and suggestion features

**Key Settings:**
- Default min score: 0.3 (balanced)
- Search fields: title, description, content
- Default limit: 20 results

**Remember:**
- Lower minScore = more results, more typos allowed
- Higher minScore = fewer results, more precise matches
- Performance scales with dataset size

For more information on other search types, see:
- [Semantic Search Guide](./SEMANTIC_SEARCH_GUIDE.md)
- [Similarity Search Guide](./SIMILARITY_SEARCH.md)
- [Recommendation System Guide](./RECOMMENDATION_SYSTEM_GUIDE.md)

