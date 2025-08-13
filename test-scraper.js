import { EquityScraper } from './src/scrapers/EquityScraper.js';

async function testScraper() {
  console.log('🧪 Testing Equity Scraper...\n');
  
  const scraper = new EquityScraper();
  
  try {
    // Test 1: Get JIOFIN data
    console.log('🔍 Test 1: Fetching JIOFIN data...');
    const jiofinData = await scraper.getEquityData('JIOFIN');
    
    if (jiofinData && jiofinData.price > 0) {
      console.log('✅ JIOFIN Data Retrieved Successfully:');
      console.log(`   Symbol: ${jiofinData.symbol}`);
      console.log(`   Price: ₹${jiofinData.price}`);
      console.log(`   Change: ₹${jiofinData.change}`);
      console.log(`   Source: ${jiofinData.source}`);
    } else {
      console.log('❌ JIOFIN data retrieval failed or returned invalid data');
    }
    
  } catch (error) {
    console.error('❌ Error testing scraper:', error.message);
  }
  
  console.log('\n🎉 Testing completed!');
}

// Run the test
testScraper().catch(console.error);
