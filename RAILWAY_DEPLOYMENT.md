# Railway Deployment Guide for Trade Book

## 🚀 Current Setup Status
✅ GitHub repo connected to Railway  
✅ PostgreSQL service added  
✅ Code committed and pushed  

## 📋 Next Steps for Railway Deployment

### Step 1: Configure Environment Variables in Railway

Go to your Railway project dashboard and set these environment variables:

#### Required Environment Variables:
```bash
# Database (from your PostgreSQL service)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/DATABASE

# Authentication Secrets (generate strong secrets)
JWT_SECRET=your-super-secure-jwt-secret-min-32-characters
SESSION_SECRET=your-super-secure-session-secret-min-32-characters

# App Configuration
NODE_ENV=production
PORT=3000

# Optional: If using individual DB params instead of DATABASE_URL
DB_HOST=containers-us-west-1.railway.app
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=your-postgres-password
```

#### How to Set Environment Variables:
1. Go to Railway Dashboard → Your Project
2. Click on your **Web Service** (not PostgreSQL)
3. Go to **Variables** tab
4. Add each environment variable above

### Step 2: Get Your PostgreSQL Connection Details

1. In Railway Dashboard, click on your **PostgreSQL service**
2. Go to **Connect** tab
3. Copy the connection details:
   - **DATABASE_URL**: Use this for the `DATABASE_URL` variable
   - Individual connection details are also shown

### Step 3: Generate Strong Secrets

For JWT_SECRET and SESSION_SECRET, use strong random strings:

```bash
# Generate secrets (run locally)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

### Step 4: Configure Railway Service Settings

1. In Railway Dashboard → Your Web Service
2. Go to **Settings** tab
3. Set these configurations:

#### Build Settings:
- **Builder**: Nixpacks (default)
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

#### Health Check:
- **Health Check Path**: `/api/health`
- **Health Check Timeout**: 100 seconds

### Step 5: Deploy and Monitor

1. **Trigger Deployment**:
   - Railway should auto-deploy when you push to GitHub
   - Or click **Deploy** button in Railway dashboard

2. **Monitor Deployment**:
   - Go to **Deployments** tab
   - Watch the build logs for any errors
   - Check the runtime logs after deployment

3. **Check Deployment Status**:
   - Look for "✅ Database connected successfully" in logs
   - Visit your Railway app URL
   - Test the `/api/health` endpoint

## 🔧 Common Deployment Issues & Fixes

### Issue 1: Database Connection Failed
**Symptoms**: "Database connection failed" in logs
**Fix**: 
- Verify `DATABASE_URL` is correct
- Check PostgreSQL service is running
- Ensure DATABASE_URL includes the correct database name

### Issue 2: Module Not Found Errors
**Symptoms**: "Cannot find package" errors
**Fix**:
- Ensure `package.json` includes all dependencies
- Check that `npm install` completed successfully
- Verify Node.js version compatibility

### Issue 3: Authentication Errors
**Symptoms**: JWT/Session errors
**Fix**:
- Ensure `JWT_SECRET` and `SESSION_SECRET` are set
- Secrets should be at least 32 characters long
- Check that secrets don't contain special characters that break parsing

### Issue 4: Port Binding Issues
**Symptoms**: "Port already in use" or connection refused
**Fix**:
- Railway automatically sets the `PORT` environment variable
- Our server uses `config.app.port` which reads from `process.env.PORT`
- Don't hardcode port 3000 in production

## 🎯 Expected Deployment Flow

1. **Build Phase**:
   ```
   ✅ Installing dependencies (npm install)
   ✅ Building application
   ```

2. **Start Phase**:
   ```
   🚀 Starting Trade Book Server...
   ✅ Database connected successfully
   🔧 Initializing database schema...
   ✅ Database schema initialized successfully
   🎉 Trade Book Server Started Successfully!
   ```

3. **Health Check**:
   ```
   GET /api/health → 200 OK
   {
     "status": "healthy",
     "timestamp": "...",
     "services": {
       "server": "running",
       "scraper": "ready"
     }
   }
   ```

## 🌐 After Successful Deployment

1. **Get Your App URL**:
   - Railway provides a URL like: `https://your-app-name.up.railway.app`

2. **Test Authentication**:
   - Visit: `https://your-app.up.railway.app/auth`
   - Create a test account
   - Login and test the trade book features

3. **Test API Endpoints**:
   - Health: `https://your-app.up.railway.app/api/health`
   - Register: `POST https://your-app.up.railway.app/api/auth/register`
   - Login: `POST https://your-app.up.railway.app/api/auth/login`

## 🔍 Debugging Deployment Issues

### View Railway Logs:
1. Railway Dashboard → Your Service → **Deployments**
2. Click on latest deployment
3. View **Build Logs** and **Deploy Logs**

### Common Log Messages:

#### Success:
```
✅ Database connected successfully
🔧 Initializing database schema...
✅ Database schema initialized successfully
🎉 Trade Book Server Started Successfully!
```

#### Database Issues:
```
❌ Database connection failed: connection refused
⚠️ Database connection failed. Please check your Railway PostgreSQL configuration.
```

#### Missing Dependencies:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express'
```

## 🚨 If Deployment Fails

1. **Check Environment Variables**:
   - Ensure all required variables are set
   - Verify DATABASE_URL format
   - Check secrets are properly generated

2. **Check Dependencies**:
   - Verify `package.json` is complete
   - Check Node.js version compatibility

3. **Database Issues**:
   - Ensure PostgreSQL service is running
   - Check database connection string
   - Verify database permissions

4. **Contact Support**:
   - Railway has excellent Discord support
   - Check Railway documentation
   - Review deployment logs carefully

## 📊 Environment Variables Checklist

Before deploying, ensure these are set in Railway:

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - Strong random string (64+ chars)
- [ ] `SESSION_SECRET` - Strong random string (64+ chars)
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000` (optional, Railway sets this automatically)

## 🎉 Success Indicators

Your deployment is successful when:
- ✅ Build completes without errors
- ✅ Server starts and shows "Trade Book Server Started Successfully!"
- ✅ Database connection established
- ✅ Health check endpoint returns 200 OK
- ✅ You can access the login page
- ✅ Authentication works correctly

Let me know if you encounter any specific errors during deployment!
