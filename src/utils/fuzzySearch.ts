/**
 * Fuzzy Search Utilities
 * Implements fuzzy string matching using Levenshtein distance
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform one string into another
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create a matrix
  const matrix: number[][] = [];
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Calculate fuzzy similarity score (0-1)
 * Higher score = more similar
 */
export function fuzzySimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  
  if (maxLength === 0) return 1.0;
  
  return 1 - (distance / maxLength);
}

/**
 * Check if a string contains fuzzy match of query
 * Returns similarity score if match found, 0 otherwise
 */
export function fuzzyMatch(text: string, query: string, threshold: number = 0.3): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match
  if (textLower.includes(queryLower)) {
    return 1.0;
  }
  
  // Word-by-word fuzzy matching
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
  const textWords = textLower.split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length === 0) return 0;
  
  let totalScore = 0;
  let matchedWords = 0;
  
  for (const queryWord of queryWords) {
    let bestScore = 0;
    
    for (const textWord of textWords) {
      // Check if word starts with query (prefix match)
      if (textWord.startsWith(queryWord)) {
        bestScore = Math.max(bestScore, 0.9);
      }
      
      // Check fuzzy similarity
      const similarity = fuzzySimilarity(queryWord, textWord);
      if (similarity >= threshold) {
        bestScore = Math.max(bestScore, similarity);
      }
    }
    
    if (bestScore > 0) {
      totalScore += bestScore;
      matchedWords++;
    }
  }
  
  // Calculate average score
  return matchedWords > 0 ? totalScore / queryWords.length : 0;
}

/**
 * Find best fuzzy matches in text
 * Returns array of matches with their positions and scores
 */
export function findFuzzyMatches(text: string, query: string, threshold: number = 0.3): Array<{
  score: number;
  matchedText: string;
  position: number;
}> {
  const matches: Array<{ score: number; matchedText: string; position: number }> = [];
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length === 0) return matches;
  
  // Split text into words with positions
  const words = textLower.split(/(\s+)/);
  let currentPos = 0;
  
  // Try matching query against sliding windows of text
  for (let i = 0; i <= words.length - queryWords.length; i++) {
    const window = words.slice(i, i + queryWords.length * 2).join('').trim();
    if (window.length === 0) continue;
    
    const score = fuzzyMatch(window, queryLower, threshold);
    if (score > 0) {
      matches.push({
        score,
        matchedText: window.substring(0, 100), // Limit length
        position: currentPos
      });
    }
    
    currentPos += words[i].length;
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

