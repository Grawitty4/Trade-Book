import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config.js';
import { userQueries } from '../database/db.js';

// Hash password
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, config.auth.saltRounds);
};

// Compare password
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate JWT token
export const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email 
    },
    config.auth.jwtSecret,
    { expiresIn: '7d' }
  );
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Authentication middleware
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    const user = await userQueries.findUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    console.log('🔍 OptionalAuth Check:', {
      hasAuthHeader: !!req.headers['authorization'],
      hasSession: !!req.session,
      sessionId: req.sessionID,
      sessionUserId: req.session?.userId,
      path: req.path
    });

    // First check for JWT token in Authorization header (for API calls)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      console.log('🔑 Checking JWT token...');
      const decoded = verifyToken(token);
      const user = await userQueries.findUserById(decoded.id);
      if (user) {
        console.log('✅ JWT authentication successful for user:', user.username);
        req.user = user;
        return next();
      }
    }
    
    // Then check for session-based auth (for browser navigation)
    if (req.session && req.session.userId) {
      console.log('👤 Checking session for userId:', req.session.userId);
      try {
        const user = await userQueries.findUserById(req.session.userId);
        if (user) {
          console.log('✅ Session authentication successful for user:', user.username);
          req.user = user;
          return next();
        } else {
          console.log('❌ User not found in database for session userId:', req.session.userId);
        }
      } catch (dbError) {
        console.log('❌ Database error during session auth:', dbError.message);
        
        // If database is offline but we have a valid session, create a minimal user object
        if (dbError.message.includes('connection') || dbError.message.includes('timeout') || dbError.message.includes('ECONNREFUSED')) {
          console.log('🔄 Database offline - using session data for authentication');
          req.user = {
            id: req.session.userId,
            username: req.session.username || 'user',
            email: 'offline@mode.com',
            full_name: req.session.username || 'Offline User',
            is_public: false,
            offline_mode: true
          };
          return next();
        }
      }
    }
    
    // No authentication found, continue without user
    console.log('🚫 No valid authentication found, continuing without user');
    next();
  } catch (error) {
    // Continue without authentication on any error
    console.log('❌ Auth check failed:', error.message);
    next();
  }
};

// Session-based authentication middleware
export const authenticateSession = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Validation helpers
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
};

export const validatePassword = (password) => {
  // At least 6 characters, contains letters and numbers
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/;
  return passwordRegex.test(password);
};

// Rate limiting helpers
const loginAttempts = new Map();

export const checkRateLimit = (identifier, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const now = Date.now();
  const userAttempts = loginAttempts.get(identifier) || { count: 0, resetTime: now + windowMs };
  
  if (now > userAttempts.resetTime) {
    userAttempts.count = 0;
    userAttempts.resetTime = now + windowMs;
  }
  
  if (userAttempts.count >= maxAttempts) {
    const timeLeft = Math.ceil((userAttempts.resetTime - now) / 1000 / 60);
    throw new Error(`Too many login attempts. Try again in ${timeLeft} minutes.`);
  }
  
  userAttempts.count++;
  loginAttempts.set(identifier, userAttempts);
  
  return true;
};

export const clearRateLimit = (identifier) => {
  loginAttempts.delete(identifier);
};

// User registration
export const registerUser = async (username, email, password, fullName) => {
  try {
    // Validate input
    if (!validateUsername(username)) {
      throw new Error('Username must be 3-30 characters and contain only letters, numbers, and underscores');
    }
    
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    
    if (!validatePassword(password)) {
      throw new Error('Password must be at least 6 characters and contain both letters and numbers');
    }

    // Check if user already exists
    const existingUser = await userQueries.findUser(username) || await userQueries.findUser(email);
    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await userQueries.createUser(username, email, passwordHash, fullName);
    
    // Create default portfolio
    const { portfolioQueries } = await import('../database/db.js');
    await portfolioQueries.createDefaultPortfolio(user.id);
    
    // Generate token
    const token = generateToken(user);
    
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        is_public: user.is_public,
        created_at: user.created_at
      },
      token
    };
  } catch (error) {
    throw error;
  }
};

// User login
export const loginUser = async (identifier, password) => {
  try {
    // Rate limiting
    checkRateLimit(identifier);
    
    // Find user
    const user = await userQueries.findUser(identifier);
    if (!user) {
      throw new Error('Invalid username/email or password');
    }

    // Compare password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid username/email or password');
    }

    // Clear rate limit on successful login
    clearRateLimit(identifier);
    
    // Update last login
    await userQueries.updateLastLogin(user.id);
    
    // Generate token
    const token = generateToken(user);
    
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        is_public: user.is_public,
        last_login: user.last_login
      },
      token
    };
  } catch (error) {
    throw error;
  }
};
