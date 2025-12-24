/**
 * Quick test script for similarity search
 * Run with: node test-similarity.js
 */

const API_BASE = 'http://localhost:3000/api/media';

async function makeRequest(method, url, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  return response.json();
}

async function testSimilaritySearch() {
  console.log('🧪 Testing Similarity Search\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Create test media items
    console.log('\n1️⃣ Creating test media items...\n');
    
    const item1 = await makeRequest('POST', `${API_BASE}/text`, {
      title: 'Introduction to Contract Law',
      content: 'A contract is a legally binding agreement between two or more parties. It requires offer, acceptance, and consideration to be valid.',
      description: 'Basic concepts of contract formation'
    });
    console.log('✅ Created:', item1.title, `(ID: ${item1.id})`);

    const item2 = await makeRequest('POST', `${API_BASE}/text`, {
      title: 'Contract Formation Requirements',
      content: 'For a contract to be legally enforceable, there must be mutual assent, consideration, capacity, and legality. The parties must agree on all essential terms.',
      description: 'Detailed requirements for valid contracts'
    });
    console.log('✅ Created:', item2.title, `(ID: ${item2.id})`);

    const item3 = await makeRequest('POST', `${API_BASE}/text`, {
      title: 'Property Law Overview',
      content: 'Property law governs the various forms of ownership and tenancy in real property and personal property. It includes rights to use, possess, and transfer property.',
      description: 'Introduction to property rights'
    });
    console.log('✅ Created:', item3.title, `(ID: ${item3.id})`);

    // Wait a bit for embeddings to be generated
    console.log('\n⏳ Waiting for embeddings to be generated...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Test text-based similarity search
    console.log('\n2️⃣ Testing text-based similarity search...\n');
    
    const searchQuery = 'What are the requirements for a valid contract?';
    console.log(`Search query: "${searchQuery}"\n`);
    
    const searchResults = await makeRequest('POST', `${API_BASE}/search`, {
      query: searchQuery,
      limit: 5,
      metric: 'cosine'
    });

    console.log(`Found ${searchResults.count} result(s):\n`);
    searchResults.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`   Distance: ${result.distance.toFixed(3)}`);
      console.log(`   Type: ${result.type}\n`);
    });

    // Step 3: Test finding similar items by ID
    console.log('3️⃣ Testing find similar items by ID...\n');
    console.log(`Finding items similar to: "${item1.title}"\n`);
    
    const similarResults = await makeRequest('GET', `${API_BASE}/${item1.id}/similar?limit=5&metric=cosine`);
    
    console.log(`Found ${similarResults.count} similar item(s):\n`);
    similarResults.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`   Distance: ${result.distance.toFixed(3)}`);
      console.log(`   Type: ${result.type}\n`);
    });

    // Step 4: Test different distance metrics
    console.log('4️⃣ Testing different distance metrics...\n');
    
    const metrics = ['cosine', 'l2', 'inner_product'];
    for (const metric of metrics) {
      console.log(`Testing with ${metric} metric:`);
      const metricResults = await makeRequest('POST', `${API_BASE}/search`, {
        query: 'contract law',
        limit: 3,
        metric
      });
      console.log(`  Found ${metricResults.count} result(s)`);
      if (metricResults.results.length > 0) {
        console.log(`  Top result: "${metricResults.results[0].title}" (similarity: ${(metricResults.results[0].similarity * 100).toFixed(1)}%)\n`);
      }
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n💡 Tips:');
    console.log('   - Try different search queries to see semantic search in action');
    console.log('   - Use the web interface at http://localhost:3000 for interactive testing');
    console.log('   - Check TESTING.md for more detailed testing instructions');

  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
    if (error.message.includes('fetch')) {
      console.error('   Make sure the server is running: npm run dev');
    }
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ (for native fetch support)');
  console.error('   Alternatively, install node-fetch: npm install node-fetch');
  process.exit(1);
}

testSimilaritySearch();


