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
    
    // Add build-time safety check to prevent network calls during build
    let htmlContent = await fs.readFile('index.html', 'utf8');
    htmlContent = htmlContent.replace(
      'document.addEventListener(\'DOMContentLoaded\', function() {',
      `document.addEventListener('DOMContentLoaded', function() {
            // Prevent network calls during Netlify build
            if (typeof process !== 'undefined' && process.env.NODE_ENV === 'build') {
                console.log('Build environment detected, skipping network calls');
                return;
            }`
    );
    await fs.writeFile('index.html', htmlContent);
    console.log('✅ Added build-time safety checks');
    
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

    // Create env.js with runtime configuration for frontend
    const backendUrl = (process.env.RAILWAY_BACKEND_URL || '').trim();
    const sanitizedBackendUrl = backendUrl.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
    const envJs = [
      'window.__ENV__ = window.__ENV__ || {};',
      `window.__ENV__.RAILWAY_BACKEND_URL = '${sanitizedBackendUrl || '##RAILWAY_BACKEND_URL##'}';`,
      ''
    ].join('\n');

    await fs.writeFile('env.js', envJs);
    console.log('✅ Created env.js with backend configuration');
    
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
