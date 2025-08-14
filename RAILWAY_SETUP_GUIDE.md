# 🚂 Railway Deployment Setup Guide

## ✅ Current Status: Deployment Successful ✅

Your Trade Book app has been deployed successfully! Now we need to set up the PostgreSQL database.

## 🗄️ Database Setup (Required)

### Step 1: Configure Railway PostgreSQL

1. **Go to your Railway project dashboard**
2. **Add PostgreSQL service:**
   - Click "+" to add a new service
   - Select "Database" > "PostgreSQL"
   - Railway will automatically create a PostgreSQL instance

3. **Get your DATABASE_URL:**
   - Click on your PostgreSQL service
   - Go to "Variables" tab
   - Copy the `DATABASE_URL` value
   - It should look like: `postgresql://postgres:password@host:port/database`

### Step 2: Set Environment Variables

**In your Trade Book web service:**

1. **Click on your web service** (not the database)
2. **Go to "Variables" tab**
3. **Add these environment variables:**

```bash
DATABASE_URL=postgresql://postgres:password@host:port/database
JWT_SECRET=0d39b0dcc431f243a26d05438cf2262afce7d8025f2308a92848411438ffe7a7ce0f896371a50e82a9e6be4a0dedfcbe73b942d2a2f23970aa204c2656a68683
SESSION_SECRET=ace2a4602615226128a5e34b7d1af6c4fe8bf8937ddc3e5a4b1aa387e62c4a9431cfe52d53d8fd16fed8938a9743abf86b2a92118e2afb2d5c9dbb454084f87d
NODE_ENV=production
```

**Important:** Replace the `DATABASE_URL` with your actual PostgreSQL URL from step 1.

### Step 3: Initialize Database Schema

**Option A: Automatic (Recommended)**
- Redeploy your app after setting environment variables
- The app will automatically detect and initialize the database schema

**Option B: Manual Setup**
If automatic setup doesn't work:

1. **Railway CLI method:**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Connect to your project
   railway link
   
   # Run database setup
   railway run node setup-railway-db.js
   ```

2. **Direct database connection:**
   - Use a PostgreSQL client to connect to your Railway database
   - Run the SQL commands from `database/schema.sql`

### Step 4: Verify Setup

1. **Visit your deployed app URL**
2. **Check the logs:** Should show "✅ Database connected successfully"
3. **Try to register:** Go to `/auth` and create an account
4. **Add a trade:** Test the trade functionality

## 🔧 Troubleshooting

### Issue: "Database connection failed"
```bash
❌ Database connection failed: Cannot read properties of undefined (reading 'searchParams')
```

**Solution:**
- Set the `DATABASE_URL` environment variable in Railway
- Make sure the PostgreSQL service is running
- Redeploy after adding environment variables

### Issue: "Schema does not exist"
```bash
❌ relation "cursor_trade_book.users" does not exist
```

**Solution:**
- Run the database setup script: `node setup-railway-db.js`
- Or manually execute the SQL from `database/schema.sql`

### Issue: "Cannot add trade"
```bash
❌ No database connection / schema not initialized
```

**Solution:**
- Complete database setup first
- Check that all tables are created in the `cursor_trade_book` schema
- Verify environment variables are set correctly

## 📊 Expected Database Schema

After setup, your Railway PostgreSQL should have:

```sql
Schema: cursor_trade_book
├── 👥 users (authentication & profiles)
├── 📊 portfolios (user portfolios)  
├── 💰 trades (buy/sell transactions)
├── 📈 positions (current holdings)
├── 🤝 friendships (social features)
├── 🔗 portfolio_shares (portfolio sharing)
├── 📊 stock_data (cached stock prices)
├── 📝 user_activities (activity log)
└── 🛠️  Functions & triggers
```

## 🎯 Next Steps After Database Setup

1. **✅ Register a new account** at `/auth`
2. **✅ Login and access main app** at `/`
3. **✅ Test stock scraper** (Tab 1)
4. **✅ Add your first trade** (Tab 2)
5. **✅ Invite friends** and share portfolios
6. **✅ Explore analytics** and P&L tracking

## 🆘 Need Help?

If you encounter any issues:

1. **Check Railway logs:** Go to your service > "Deployments" > Click latest deployment > "View Logs"
2. **Verify database:** Make sure PostgreSQL service is running and accessible
3. **Test locally:** Run `npm start` locally with Railway `DATABASE_URL` to debug
4. **Check environment variables:** Ensure all required variables are set

Your app should be fully functional after completing the database setup! 🚀
