-- ============================================================================
-- SUPABASE / POSTGRESQL DATABASE SCHEMA FOR LOCALS PROJECT
-- ============================================================================
-- Copy and run this script in the Supabase SQL Editor.
-- NOTE: Primary keys are typed as VARCHAR(24) to allow direct migration of
-- MongoDB ObjectIDs without complex mapping, keeping relations intact.
-- ============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(24) PRIMARY KEY,
    name TEXT,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(320) UNIQUE,
    password TEXT,
    avatar TEXT,
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
    addresses JSONB DEFAULT '[]'::jsonb,
    role VARCHAR(20) DEFAULT 'User' NOT NULL CHECK (role IN ('User', 'Merchant', 'Delivery')),
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_profile_complete BOOLEAN DEFAULT FALSE,
    verification_status VARCHAR(30) DEFAULT 'not_required' CHECK (verification_status IN ('not_required', 'pending_documents', 'pending_review', 'approved', 'rejected')),
    verification_documents JSONB DEFAULT '[]'::jsonb,
    verification_submitted_at TIMESTAMP WITH TIME ZONE,
    verification_reviewed_at TIMESTAMP WITH TIME ZONE,
    verification_review_note TEXT,
    verification_grandfathered BOOLEAN DEFAULT FALSE,
    otp VARCHAR(10),
    otp_expiry TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    current_location_lat DOUBLE PRECISION,
    current_location_lng DOUBLE PRECISION,
    is_busy BOOLEAN DEFAULT FALSE,
    current_order_id VARCHAR(24),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for optimized querying on users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active_busy ON users(role, is_active, is_busy);

-- 2. STORES TABLE
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(24) PRIMARY KEY,
    merchant_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    description TEXT,
    store_images JSONB DEFAULT '[]'::jsonb,
    address TEXT NOT NULL,
    map_link TEXT NOT NULL,
    contact_phone VARCHAR(15),
    contact_email VARCHAR(320),
    contact_website TEXT,
    working_days JSONB DEFAULT '{"monday":false,"tuesday":false,"wednesday":false,"thursday":false,"friday":false,"saturday":false,"sunday":false}'::jsonb,
    rating_average NUMERIC(3,2) DEFAULT 0.0,
    rating_total_reviews INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    pre_verification_store BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stores_merchant ON stores(merchant_id);
CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(store_name);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(24) PRIMARY KEY,
    store_id VARCHAR(24) REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    original_price NUMERIC(10,2),
    discount_percent NUMERIC(5,2),
    category TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    in_stock BOOLEAN DEFAULT TRUE,
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(24) PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE RESTRICT,
    store_id VARCHAR(24) REFERENCES stores(id) ON DELETE RESTRICT,
    items JSONB NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Refunded', 'PartiallyRefunded')),
    payment_method VARCHAR(20) DEFAULT 'COD' CHECK (payment_method IN ('COD', 'Razorpay')),
    status VARCHAR(30) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Processing', 'ReadyForPickup', 'Assigned', 'PickedUp', 'OnTheWay', 'Shipped', 'Delivered', 'Cancelled')),
    delivery_address TEXT NOT NULL,
    delivery_location_lat DOUBLE PRECISION,
    delivery_location_lng DOUBLE PRECISION,
    delivery_date TIMESTAMP WITH TIME ZONE,
    payment_details JSONB DEFAULT '{}'::jsonb,
    delivery_partner_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    otp VARCHAR(10),
    otp_verified BOOLEAN DEFAULT FALSE,
    rejection_reason TEXT,
    store_rating NUMERIC(3,2),
    store_review TEXT,
    store_rated BOOLEAN DEFAULT FALSE,
    store_rated_at TIMESTAMP WITH TIME ZONE,
    delivery_rating NUMERIC(3,2),
    delivery_review TEXT,
    delivery_rated BOOLEAN DEFAULT FALSE,
    delivery_rated_at TIMESTAMP WITH TIME ZONE,
    status_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON orders(delivery_partner_id);

-- 5. FAVORITES TABLE
CREATE TABLE IF NOT EXISTS favorites (
    id VARCHAR(24) PRIMARY KEY,
    user_id VARCHAR(24) UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    stores JSONB DEFAULT '[]'::jsonb,
    products JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(24) PRIMARY KEY,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    order_id VARCHAR(24) REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read);

-- 7. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(24) PRIMARY KEY,
    order_id VARCHAR(24) REFERENCES orders(id) ON DELETE RESTRICT,
    payment_id VARCHAR(100),
    razorpay_order_id VARCHAR(100),
    razorpay_signature TEXT,
    amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    method VARCHAR(50),
    refund_id VARCHAR(100),
    refund_status VARCHAR(20),
    refund_amount NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- 8. RETURNS TABLE
CREATE TABLE IF NOT EXISTS returns (
    id VARCHAR(24) PRIMARY KEY,
    order_id VARCHAR(24) REFERENCES orders(id) ON DELETE RESTRICT,
    items JSONB NOT NULL,
    reason TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed')),
    store_notes TEXT,
    refund_amount NUMERIC(10,2),
    refund_status VARCHAR(20),
    refund_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);

-- 9. SYSTEM SETTINGS TABLE (For Dynamic Configs)
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(24) PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON system_settings(key);
