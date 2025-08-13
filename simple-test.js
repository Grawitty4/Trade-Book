// Simple test to verify basic functionality
console.log('🧪 Simple Test Started');

// Test basic Node.js functionality
const axios = require('axios');

async function testBasicScraping() {
  try {
    console.log('🔍 Testing basic web scraping...');
    
    // Test a simple HTTP request
    const response = await axios.get('https://httpbin.org/get', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    console.log('✅ Basic HTTP request successful');
    console.log(`   Status: ${response.status}`);
    console.log(`   Data received: ${response.data ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('❌ Basic test failed:', error.message);
  }
}

// Run the test
testBasicScraping().then(() => {
  console.log('\n🎉 Basic test completed!');
}).catch(console.error);
