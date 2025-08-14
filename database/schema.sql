-- Trade Book Database Schema
-- Schema: cursor_trade_book

-- Create the schema
CREATE SCHEMA IF NOT EXISTS cursor_trade_book;

-- Set the search path to use our schema
SET search_path TO cursor_trade_book;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    profile_picture TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- User sessions table (for express-session)
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);

-- Friendships table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(requester_id, addressee_id)
);

-- Portfolio sharing permissions
CREATE TABLE IF NOT EXISTS portfolio_shares (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_view_trades BOOLEAN DEFAULT true,
    can_view_performance BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_id, shared_with_id)
);

-- User portfolios
CREATE TABLE IF NOT EXISTS portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) DEFAULT 'My Portfolio',
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    trade_type VARCHAR(10) NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    trade_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Portfolio positions (calculated from trades)
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    average_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_invested DECIMAL(12, 2) NOT NULL DEFAULT 0,
    current_price DECIMAL(10, 2) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, portfolio_id, symbol)
);

-- Stock data cache (for performance)
CREATE TABLE IF NOT EXISTS stock_data (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) UNIQUE NOT NULL,
    current_price DECIMAL(10, 2),
    change_amount DECIMAL(10, 2),
    change_percent DECIMAL(5, 2),
    volume BIGINT,
    day_high DECIMAL(10, 2),
    day_low DECIMAL(10, 2),
    open_price DECIMAL(10, 2),
    prev_close DECIMAL(10, 2),
    market_cap BIGINT,
    source VARCHAR(50),
    is_real_data BOOLEAN DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User activity log
CREATE TABLE IF NOT EXISTS user_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_shares_owner ON portfolio_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_shares_shared_with ON portfolio_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_portfolio ON trades(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(trade_date);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_data_symbol ON stock_data(symbol);
CREATE INDEX IF NOT EXISTS idx_user_activities_user ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities(activity_type);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get user's friends
CREATE OR REPLACE FUNCTION get_user_friends(user_id_param INTEGER)
RETURNS TABLE(
    friend_id INTEGER,
    friend_username VARCHAR(50),
    friend_full_name VARCHAR(100),
    friend_profile_picture TEXT,
    friendship_status VARCHAR(20),
    friendship_created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN f.requester_id = user_id_param THEN f.addressee_id
            ELSE f.requester_id
        END as friend_id,
        u.username as friend_username,
        u.full_name as friend_full_name,
        u.profile_picture as friend_profile_picture,
        f.status as friendship_status,
        f.created_at as friendship_created_at
    FROM friendships f
    JOIN users u ON (
        CASE 
            WHEN f.requester_id = user_id_param THEN u.id = f.addressee_id
            ELSE u.id = f.requester_id
        END
    )
    WHERE (f.requester_id = user_id_param OR f.addressee_id = user_id_param)
    AND f.status = 'accepted';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate portfolio performance
CREATE OR REPLACE FUNCTION calculate_portfolio_performance(user_id_param INTEGER, portfolio_id_param INTEGER)
RETURNS TABLE(
    total_invested DECIMAL(12, 2),
    current_value DECIMAL(12, 2),
    total_pnl DECIMAL(12, 2),
    total_pnl_percent DECIMAL(5, 2),
    active_positions INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(p.total_invested), 0) as total_invested,
        COALESCE(SUM(p.total_quantity * COALESCE(sd.current_price, p.average_price)), 0) as current_value,
        COALESCE(SUM(p.total_quantity * COALESCE(sd.current_price, p.average_price)) - SUM(p.total_invested), 0) as total_pnl,
        CASE 
            WHEN SUM(p.total_invested) > 0 THEN 
                ((SUM(p.total_quantity * COALESCE(sd.current_price, p.average_price)) - SUM(p.total_invested)) / SUM(p.total_invested) * 100)
            ELSE 0
        END as total_pnl_percent,
        COUNT(*)::INTEGER as active_positions
    FROM positions p
    LEFT JOIN stock_data sd ON p.symbol = sd.symbol
    WHERE p.user_id = user_id_param 
    AND p.portfolio_id = portfolio_id_param
    AND p.total_quantity > 0;
END;
$$ LANGUAGE plpgsql;

-- Insert default data
INSERT INTO users (username, email, password_hash, full_name, is_public) 
VALUES ('demo_user', 'demo@example.com', '$2b$12$demo.hash.for.testing', 'Demo User', true)
ON CONFLICT (username) DO NOTHING;

-- Create default portfolio for demo user
INSERT INTO portfolios (user_id, name, description, is_default)
SELECT id, 'My Portfolio', 'Default portfolio', true
FROM users WHERE username = 'demo_user'
ON CONFLICT DO NOTHING;

COMMIT;
