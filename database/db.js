import pkg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: config.database.url,
  max: config.database.max,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.connectionTimeoutMillis,
  ssl: config.app.nodeEnv === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connected successfully at:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Initialize database schema
export const initializeDatabase = async () => {
  try {
    console.log('🔧 Initializing database schema...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    const client = await pool.connect();
    await client.query(schema);
    client.release();
    
    console.log('✅ Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

// Query helper function
export const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (config.app.nodeEnv === 'development') {
      console.log('📊 Query executed:', { text: text.substring(0, 100), duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    console.error('Query:', text.substring(0, 200));
    throw error;
  }
};

// Transaction helper
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// User-related database functions
export const userQueries = {
  // Create new user
  createUser: async (username, email, passwordHash, fullName = null) => {
    const text = `
      INSERT INTO cursor_trade_book.users (username, email, password_hash, full_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, full_name, is_public, created_at
    `;
    const result = await query(text, [username, email, passwordHash, fullName]);
    return result.rows[0];
  },

  // Find user by username or email
  findUser: async (identifier) => {
    const text = `
      SELECT id, username, email, password_hash, full_name, is_public, created_at, last_login
      FROM cursor_trade_book.users
      WHERE username = $1 OR email = $1
    `;
    const result = await query(text, [identifier]);
    return result.rows[0];
  },

  // Find user by ID
  findUserById: async (userId) => {
    const text = `
      SELECT id, username, email, full_name, is_public, profile_picture, created_at, last_login
      FROM cursor_trade_book.users
      WHERE id = $1
    `;
    const result = await query(text, [userId]);
    return result.rows[0];
  },

  // Update user's last login
  updateLastLogin: async (userId) => {
    const text = `
      UPDATE cursor_trade_book.users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await query(text, [userId]);
  },

  // Update user privacy setting
  updatePrivacySetting: async (userId, isPublic) => {
    const text = `
      UPDATE cursor_trade_book.users
      SET is_public = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING is_public
    `;
    const result = await query(text, [userId, isPublic]);
    return result.rows[0];
  },

  // Search users for friend requests
  searchUsers: async (searchTerm, currentUserId, limit = 10) => {
    const text = `
      SELECT id, username, full_name, profile_picture, is_public
      FROM cursor_trade_book.users
      WHERE (username ILIKE $1 OR full_name ILIKE $1)
      AND id != $2
      AND id NOT IN (
        SELECT CASE 
          WHEN requester_id = $2 THEN addressee_id
          ELSE requester_id
        END
        FROM cursor_trade_book.friendships
        WHERE (requester_id = $2 OR addressee_id = $2)
        AND status IN ('pending', 'accepted')
      )
      ORDER BY 
        CASE WHEN is_public THEN 0 ELSE 1 END,
        username
      LIMIT $3
    `;
    const result = await query(text, [`%${searchTerm}%`, currentUserId, limit]);
    return result.rows;
  }
};

// Friendship-related database functions
export const friendshipQueries = {
  // Send friend request
  sendFriendRequest: async (requesterId, addresseeId) => {
    const text = `
      INSERT INTO cursor_trade_book.friendships (requester_id, addressee_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (requester_id, addressee_id) 
      DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await query(text, [requesterId, addresseeId]);
    return result.rows[0];
  },

  // Accept friend request
  acceptFriendRequest: async (requesterId, addresseeId) => {
    const text = `
      UPDATE cursor_trade_book.friendships
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE requester_id = $1 AND addressee_id = $2
      RETURNING *
    `;
    const result = await query(text, [requesterId, addresseeId]);
    return result.rows[0];
  },

  // Get user's friends
  getUserFriends: async (userId) => {
    const text = `SELECT * FROM cursor_trade_book.get_user_friends($1)`;
    const result = await query(text, [userId]);
    return result.rows;
  },

  // Get pending friend requests
  getPendingRequests: async (userId) => {
    const text = `
      SELECT f.*, u.username, u.full_name, u.profile_picture
      FROM cursor_trade_book.friendships f
      JOIN cursor_trade_book.users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    const result = await query(text, [userId]);
    return result.rows;
  }
};

// Portfolio-related database functions
export const portfolioQueries = {
  // Create default portfolio for new user
  createDefaultPortfolio: async (userId) => {
    const text = `
      INSERT INTO cursor_trade_book.portfolios (user_id, name, description, is_default)
      VALUES ($1, 'My Portfolio', 'Default portfolio', true)
      RETURNING *
    `;
    const result = await query(text, [userId]);
    return result.rows[0];
  },

  // Get user's portfolios
  getUserPortfolios: async (userId) => {
    const text = `
      SELECT * FROM cursor_trade_book.portfolios
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at ASC
    `;
    const result = await query(text, [userId]);
    return result.rows;
  },

  // Get portfolio performance
  getPortfolioPerformance: async (userId, portfolioId) => {
    const text = `SELECT * FROM cursor_trade_book.calculate_portfolio_performance($1, $2)`;
    const result = await query(text, [userId, portfolioId]);
    return result.rows[0];
  }
};

// Portfolio sharing functions
export const sharingQueries = {
  // Share portfolio with friends
  sharePortfolioWithFriends: async (ownerId, friendIds) => {
    const values = friendIds.map((friendId, index) => 
      `($1, $${index + 2}, true, true)`
    ).join(', ');
    
    const text = `
      INSERT INTO cursor_trade_book.portfolio_shares (owner_id, shared_with_id, can_view_trades, can_view_performance)
      VALUES ${values}
      ON CONFLICT (owner_id, shared_with_id) 
      DO UPDATE SET 
        can_view_trades = true,
        can_view_performance = true,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const params = [ownerId, ...friendIds];
    const result = await query(text, params);
    return result.rows;
  },

  // Get shared portfolios (portfolios shared with current user)
  getSharedPortfolios: async (userId) => {
    const text = `
      SELECT 
        ps.*,
        u.username as owner_username,
        u.full_name as owner_full_name,
        p.name as portfolio_name,
        p.description as portfolio_description
      FROM cursor_trade_book.portfolio_shares ps
      JOIN cursor_trade_book.users u ON u.id = ps.owner_id
      JOIN cursor_trade_book.portfolios p ON p.user_id = ps.owner_id AND p.is_default = true
      WHERE ps.shared_with_id = $1
      ORDER BY ps.created_at DESC
    `;
    const result = await query(text, [userId]);
    return result.rows;
  }
};

// Graceful shutdown
export const closePool = async () => {
  await pool.end();
  console.log('🔌 Database connection pool closed');
};

// Handle process termination
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

export default pool;
