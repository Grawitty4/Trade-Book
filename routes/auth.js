import express from 'express';
import { registerUser, loginUser } from '../middleware/auth.js';
import { userQueries, friendshipQueries, sharingQueries } from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config.js';

const router = express.Router();

// In-memory user store for offline mode
const offlineUsers = new Map();
let nextUserId = 1;

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }

    try {
      const result = await registerUser(username, email, password, fullName);
      
      // Set session if using session-based auth
      req.session.userId = result.user.id;
      req.session.username = result.user.username;
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        ...result
      });
      
    } catch (dbError) {
      console.log('❌ Database error, using offline mode for registration:', dbError.message);
      
      // Check if user already exists in offline store
      for (const [id, user] of offlineUsers) {
        if (user.username === username || user.email === email) {
          return res.status(400).json({
            error: 'Username or email already exists'
          });
        }
      }
      
      // Create offline user
      const userId = nextUserId++;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = {
        id: userId,
        username,
        email,
        full_name: fullName || username,
        is_public: false,
        created_at: new Date().toISOString(),
        password_hash: hashedPassword
      };
      
      offlineUsers.set(userId, user);
      
      // Set session
      req.session.userId = userId;
      req.session.username = username;
      
      console.log('✅ Offline registration successful:', {
        userId: req.session.userId,
        username: req.session.username,
        sessionId: req.sessionID,
        totalOfflineUsers: offlineUsers.size
      });
      
      const token = jwt.sign({ id: userId }, config.auth.jwtSecret, { expiresIn: '7d' });
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully (offline mode)',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          is_public: user.is_public
        },
        token
      });
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      error: error.message || 'Registration failed' 
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({ 
        error: 'Username/email and password are required' 
      });
    }

    try {
      const result = await loginUser(identifier, password);
      
      // Set session
      req.session.userId = result.user.id;
      req.session.username = result.user.username;
      
      console.log('✅ Login successful, session set:', {
        userId: req.session.userId,
        username: req.session.username,
        sessionId: req.sessionID
      });
      
      res.json({
        success: true,
        message: 'Login successful',
        ...result
      });
      
    } catch (dbError) {
      console.log('❌ Database error, using offline mode for login:', dbError.message);
      
      // Try offline login
      let foundUser = null;
      for (const [id, user] of offlineUsers) {
        if (user.username === identifier || user.email === identifier) {
          foundUser = user;
          break;
        }
      }
      
      if (!foundUser) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, foundUser.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }
      
      // Set session
      req.session.userId = foundUser.id;
      req.session.username = foundUser.username;
      
      console.log('✅ Offline login successful, session set:', {
        userId: req.session.userId,
        username: req.session.username,
        sessionId: req.sessionID
      });
      
      const token = jwt.sign({ id: foundUser.id }, config.auth.jwtSecret, { expiresIn: '7d' });
      
      res.json({
        success: true,
        message: 'Login successful (offline mode)',
        user: {
          id: foundUser.id,
          username: foundUser.username,
          email: foundUser.email,
          full_name: foundUser.full_name,
          is_public: foundUser.is_public
        },
        token
      });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      error: error.message || 'Login failed' 
    });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await userQueries.findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        is_public: user.is_public,
        profile_picture: user.profile_picture,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update privacy setting
router.patch('/privacy', authenticateToken, async (req, res) => {
  try {
    const { isPublic } = req.body;
    
    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'isPublic must be a boolean' });
    }
    
    const result = await userQueries.updatePrivacySetting(req.user.id, isPublic);
    
    res.json({
      success: true,
      message: 'Privacy setting updated',
      is_public: result.is_public
    });
    
  } catch (error) {
    console.error('Privacy update error:', error);
    res.status(500).json({ error: 'Failed to update privacy setting' });
  }
});

// Search users for friend requests
router.get('/search-users', authenticateToken, async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    if (!searchTerm || searchTerm.length < 2) {
      return res.status(400).json({ 
        error: 'Search term must be at least 2 characters' 
      });
    }
    
    const users = await userQueries.searchUsers(searchTerm, req.user.id, 10);
    
    res.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        profile_picture: user.profile_picture,
        is_public: user.is_public
      }))
    });
    
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Send friend request
router.post('/friend-request', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId || userId === req.user.id) {
      return res.status(400).json({ 
        error: 'Invalid user ID' 
      });
    }
    
    // Check if user exists
    const targetUser = await userQueries.findUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const friendship = await friendshipQueries.sendFriendRequest(req.user.id, userId);
    
    res.json({
      success: true,
      message: 'Friend request sent',
      friendship
    });
    
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Accept friend request
router.post('/accept-friend', authenticateToken, async (req, res) => {
  try {
    const { requesterId } = req.body;
    
    if (!requesterId) {
      return res.status(400).json({ error: 'Requester ID is required' });
    }
    
    const friendship = await friendshipQueries.acceptFriendRequest(requesterId, req.user.id);
    
    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    res.json({
      success: true,
      message: 'Friend request accepted',
      friendship
    });
    
  } catch (error) {
    console.error('Accept friend error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Get user's friends
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const friends = await friendshipQueries.getUserFriends(req.user.id);
    
    res.json({
      success: true,
      friends
    });
    
  } catch (error) {
    console.error('Friends fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Get pending friend requests
router.get('/friend-requests', authenticateToken, async (req, res) => {
  try {
    const requests = await friendshipQueries.getPendingRequests(req.user.id);
    
    res.json({
      success: true,
      requests
    });
    
  } catch (error) {
    console.error('Friend requests fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// Share portfolio with friends
router.post('/share-portfolio', authenticateToken, async (req, res) => {
  try {
    const { friendIds } = req.body;
    
    if (!Array.isArray(friendIds) || friendIds.length === 0) {
      return res.status(400).json({ 
        error: 'Friend IDs array is required' 
      });
    }
    
    // Verify all friend IDs are actual friends
    const userFriends = await friendshipQueries.getUserFriends(req.user.id);
    const friendIdSet = new Set(userFriends.map(f => f.friend_id));
    
    const invalidIds = friendIds.filter(id => !friendIdSet.has(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        error: 'Some user IDs are not your friends' 
      });
    }
    
    const shares = await sharingQueries.sharePortfolioWithFriends(req.user.id, friendIds);
    
    res.json({
      success: true,
      message: 'Portfolio shared successfully',
      shares
    });
    
  } catch (error) {
    console.error('Portfolio sharing error:', error);
    res.status(500).json({ error: 'Failed to share portfolio' });
  }
});

// Get shared portfolios (portfolios shared with current user)
router.get('/shared-portfolios', authenticateToken, async (req, res) => {
  try {
    const sharedPortfolios = await sharingQueries.getSharedPortfolios(req.user.id);
    
    res.json({
      success: true,
      shared_portfolios: sharedPortfolios
    });
    
  } catch (error) {
    console.error('Shared portfolios fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch shared portfolios' });
  }
});

// Get current user info (for frontend)
router.get('/me', async (req, res) => {
  try {
    console.log('🔍 /api/auth/me called:', {
      hasSession: !!req.session,
      sessionUserId: req.session?.userId,
      sessionId: req.sessionID
    });

    // Check session-based auth first (for browser requests)
    if (req.session && req.session.userId) {
      try {
        const user = await userQueries.findUserById(req.session.userId);
        if (user) {
          console.log('✅ User found via session:', user.username);
          return res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              full_name: user.full_name,
              is_public: user.is_public
            }
          });
        }
      } catch (dbError) {
        console.log('❌ Database error in /me, checking offline users:', dbError.message);
        
        // Check offline users
        const offlineUser = offlineUsers.get(req.session.userId);
        if (offlineUser) {
          console.log('✅ Offline user found via session:', offlineUser.username);
          return res.json({
            success: true,
            user: {
              id: offlineUser.id,
              username: offlineUser.username,
              email: offlineUser.email,
              full_name: offlineUser.full_name,
              is_public: offlineUser.is_public
            }
          });
        }
        
        return res.status(503).json({
          success: false,
          error: 'Database is currently offline and no offline user found'
        });
      }
    }

    // If no session, return not authenticated
    console.log('🚫 No valid session found');
    res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  } catch (error) {
    console.error('❌ Error in /api/auth/me:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Check authentication status
router.get('/check', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.json({
        success: false,
        authenticated: false,
        error: 'No token provided'
      });
    }

    // Try to authenticate with database
    try {
      const { verifyToken } = await import('../middleware/auth.js');
      const decoded = verifyToken(token);
      const user = await userQueries.findUserById(decoded.id);
      
      if (!user) {
        return res.json({
          success: false,
          authenticated: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          is_public: user.is_public
        }
      });
    } catch (dbError) {
      // If database is offline, at least verify the token is valid
      if (dbError.message.includes('connection') || dbError.message.includes('timeout')) {
        try {
          const { verifyToken } = await import('../middleware/auth.js');
          const decoded = verifyToken(token);
          res.json({
            success: false,
            authenticated: false,
            error: 'Database offline - please try again later',
            type: 'database_offline'
          });
        } catch (tokenError) {
          res.json({
            success: false,
            authenticated: false,
            error: 'Invalid token'
          });
        }
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Auth check error:', error);
    res.json({
      success: false,
      authenticated: false,
      error: 'Authentication check failed'
    });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  try {
    // Destroy session if it exists
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.log('Session destroy error:', err);
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

export default router;
