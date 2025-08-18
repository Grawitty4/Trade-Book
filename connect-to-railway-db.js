#!/usr/bin/env node

/**
 * Script to connect local development server to Railway database
 * Run this to use Railway database locally instead of offline mode
 */

import { execSync } from 'child_process';

const RAILWAY_DATABASE_URL = 'postgresql://postgres:vDvlAOOyQjHNUwilGWaJKEOGKbgzCXeS@containers-us-west-1.railway.app:5432/railway';

console.log('🚀 Connecting local server to Railway database...');

try {
    // Set environment variables and start server
    process.env.DATABASE_URL = RAILWAY_DATABASE_URL;
    process.env.JWT_SECRET = 'railway-jwt-secret-key-2024';
    process.env.SESSION_SECRET = 'railway-session-secret-key-2024';
    process.env.NODE_ENV = 'development';
    
    console.log('✅ Environment configured for Railway database');
    console.log('🔌 Starting server with Railway database connection...');
    
    // Start the server
    execSync('npm start', { stdio: 'inherit' });
    
} catch (error) {
    console.error('❌ Failed to connect to Railway database:', error.message);
    process.exit(1);
}
