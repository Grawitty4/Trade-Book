import dotenv from 'dotenv';

dotenv.config();

const config = {
  database: {
    // Railway PostgreSQL connection
    // You'll need to replace this with your actual Railway database URL
    url: process.env.DATABASE_URL || 'postgresql://username:password@host:port/cursor_trade_book',
    
    // Alternative individual connection parameters
    host: process.env.DB_HOST || 'containers-us-west-1.railway.app',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'cursor_trade_book',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your-password',
    
    // Connection pool settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-key-change-this-in-production',
    saltRounds: 12,
  },
  
  app: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  }
};

export default config;
