# Railway PostgreSQL Setup Guide

## 🚀 Setting up Railway PostgreSQL for Trade Book

### Step 1: Create Railway Account
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub or email
3. Create a new project

### Step 2: Add PostgreSQL Database
1. In your Railway project, click "Add Service"
2. Select "Database" → "PostgreSQL"
3. Wait for deployment (usually 1-2 minutes)

### Step 3: Get Database Credentials
1. Click on your PostgreSQL service
2. Go to "Variables" tab
3. You'll see these environment variables:
   - `DATABASE_URL` (complete connection string)
   - `PGDATABASE` (database name)
   - `PGHOST` (host address)
   - `PGPASSWORD` (password)
   - `PGPORT` (port, usually 5432)
   - `PGUSER` (username, usually postgres)

### Step 4: Configure Trade Book
1. Open `config.js` in your Trade Book project
2. Replace the database configuration:

```javascript
const config = {
  database: {
    // Replace with your Railway DATABASE_URL
    url: 'postgresql://postgres:YOUR_PASSWORD@containers-us-west-1.railway.app:5432/railway',
    
    // Or use individual parameters:
    host: 'containers-us-west-1.railway.app',
    port: 5432,
    database: 'railway',
    user: 'postgres',
    password: 'YOUR_PASSWORD',
    
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  // ... rest of config
};
```

### Step 5: Test Connection
1. Start your Trade Book server:
   ```bash
   node server.js
   ```

2. Look for this message:
   ```
   ✅ Database connected successfully at: [timestamp]
   🔧 Initializing database schema...
   ✅ Database schema initialized successfully
   ```

### Step 6: Verify Database Setup
1. Go to Railway dashboard → PostgreSQL service → "Data" tab
2. You should see tables created in the `cursor_trade_book` schema:
   - `users`
   - `portfolios`
   - `trades`
   - `positions`
   - `friendships`
   - `portfolio_shares`
   - `stock_data`
   - `user_activities`

## 🔧 Environment Variables (Optional)

Instead of hardcoding credentials, you can use environment variables:

### Create `.env` file:
```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@containers-us-west-1.railway.app:5432/railway
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-session-secret-key-change-this-in-production
NODE_ENV=development
PORT=3000
```

### Update config.js to use environment variables:
```javascript
import dotenv from 'dotenv';
dotenv.config();

const config = {
  database: {
    url: process.env.DATABASE_URL,
    // ...
  },
  // ...
};
```

## 🚨 Troubleshooting

### Connection Failed
- ✅ Check Railway service is running (green status)
- ✅ Verify credentials are correct
- ✅ Ensure Railway PostgreSQL service is deployed
- ✅ Check network connectivity

### Schema Not Created
- ✅ Check server logs for database initialization errors
- ✅ Verify user has CREATE privileges
- ✅ Check `database/schema.sql` file exists

### Authentication Issues
- ✅ Ensure JWT_SECRET is set
- ✅ Check session configuration
- ✅ Verify PostgreSQL session table exists

## 📊 Database Schema Overview

The Trade Book uses these main tables:

- **users**: User accounts and profiles
- **portfolios**: User portfolio containers
- **trades**: Individual buy/sell transactions
- **positions**: Calculated portfolio positions
- **friendships**: User friend relationships
- **portfolio_shares**: Portfolio sharing permissions
- **stock_data**: Cached stock price data
- **session**: User session storage

## 🎯 Next Steps

Once database is set up:

1. **Create Account**: Visit `/auth` to register
2. **Add Trades**: Start building your portfolio
3. **Add Friends**: Search and connect with other users
4. **Share Portfolio**: Toggle public/private and share with friends
5. **Analyze Performance**: View P&L and performance metrics

## 💡 Production Deployment

For production deployment:

1. **Railway App Deployment**:
   - Connect your GitHub repo to Railway
   - Set environment variables in Railway dashboard
   - Deploy automatically on git push

2. **Security Settings**:
   - Use strong JWT and session secrets
   - Enable SSL in production
   - Set secure cookie flags
   - Configure CORS properly

## 🆘 Support

If you encounter issues:

1. Check Railway service logs
2. Check Trade Book server logs
3. Verify all environment variables
4. Test database connection manually

Example connection test:
```bash
psql "postgresql://postgres:PASSWORD@HOST:5432/DATABASE"
```
