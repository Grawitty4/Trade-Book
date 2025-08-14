#!/usr/bin/env node

/**
 * Railway Database Setup Script
 * 
 * This script initializes the PostgreSQL database schema on Railway.
 * Run this once after deploying to Railway to set up the database.
 * 
 * Usage:
 *   node setup-railway-db.js
 * 
 * Make sure your Railway DATABASE_URL environment variable is set.
 */

import { testConnection, initializeDatabase, closePool } from './database/db.js';
import config from './config.js';

async function setupRailwayDatabase() {
  console.log('🚀 Railway Database Setup');
  console.log('==========================');
  
  // Check if DATABASE_URL is configured
  if (!process.env.DATABASE_URL && config.database.url.includes('username:password')) {
    console.error('❌ DATABASE_URL environment variable not set!');
    console.error('');
    console.error('🔧 Setup Instructions:');
    console.error('1. Go to your Railway project dashboard');
    console.error('2. Click on your PostgreSQL service');
    console.error('3. Go to "Variables" tab');
    console.error('4. Copy the DATABASE_URL');
    console.error('5. Add it as an environment variable to your web service');
    console.error('');
    console.error('💡 The DATABASE_URL should look like:');
    console.error('   postgresql://postgres:password@host:port/database');
    process.exit(1);
  }
  
  console.log('🔗 Database URL configured:', process.env.DATABASE_URL ? '✅ Yes' : '❌ No');
  console.log('');
  
  try {
    // Test connection
    console.log('🔍 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Could not connect to database. Check your Railway PostgreSQL configuration.');
      process.exit(1);
    }
    
    console.log('');
    console.log('🔧 Initializing database schema...');
    console.log('This will create:');
    console.log('  📋 Schema: cursor_trade_book');
    console.log('  👥 Table: users');
    console.log('  📊 Table: portfolios');
    console.log('  💰 Table: trades');
    console.log('  📈 Table: positions');
    console.log('  🤝 Table: friendships');
    console.log('  🔗 Table: portfolio_shares');
    console.log('  📊 Table: stock_data');
    console.log('  📝 Table: user_activities');
    console.log('  🛠️  Functions and triggers');
    console.log('');
    
    // Initialize schema
    await initializeDatabase();
    
    console.log('');
    console.log('🎉 Database setup completed successfully!');
    console.log('');
    console.log('✅ Your Railway database is now ready for the Trade Book app');
    console.log('');
    console.log('🔄 Next steps:');
    console.log('1. Restart your Railway deployment');
    console.log('2. Visit your app URL');
    console.log('3. Create a user account');
    console.log('4. Start adding trades!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('1. Verify DATABASE_URL is correct');
    console.error('2. Check Railway PostgreSQL service is running');
    console.error('3. Ensure database exists and is accessible');
    console.error('4. Check Railway deployment logs for more details');
    console.error('');
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupRailwayDatabase();
}

export default setupRailwayDatabase;
