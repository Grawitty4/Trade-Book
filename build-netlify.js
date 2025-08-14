#!/usr/bin/env node

/**
 * Netlify Build Script for Trade Book
 * 
 * This script prepares the frontend for Netlify deployment
 * by copying files and updating configuration.
 */

import fs from 'fs/promises';
import path from 'path';

async function buildForNetlify() {
  console.log('🚀 Building Trade Book for Netlify...');
  
  try {
    // Copy index.html to root for Netlify
    await fs.copyFile('public/index.html', 'index.html');
    console.log('✅ Copied index.html to root');
    
    // Create a simple manifest
    const manifest = {
      name: "Trade Book",
      short_name: "TradeBook", 
      description: "Portfolio Management & Stock Analysis",
      start_url: "/",
      display: "standalone",
      background_color: "#667eea",
      theme_color: "#667eea",
      icons: []
    };
    
    await fs.writeFile('manifest.json', JSON.stringify(manifest, null, 2));
    console.log('✅ Created manifest.json');
    
    // Create a basic robots.txt
    const robots = `User-agent: *
Allow: /

Sitemap: https://your-netlify-site.netlify.app/sitemap.xml`;
    
    await fs.writeFile('robots.txt', robots);
    console.log('✅ Created robots.txt');
    
    console.log('🎉 Netlify build completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Update RAILWAY_BACKEND_URL in index.html');
    console.log('2. Deploy to Netlify');
    console.log('3. Test the integration');
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run build if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildForNetlify();
}

export default buildForNetlify;
