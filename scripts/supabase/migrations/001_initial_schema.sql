-- Initial database schema for Uber-style ride-sharing platform

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('passenger', 'driver', 'admin')),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_type ON users(user_type);

-- Create driver_profiles table
CREATE TABLE driver_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    car_model VARCHAR(100) NOT NULL,
    car_plate VARCHAR(20) NOT NULL,
    rating DECIMAL(3,2) DEFAULT 5.00,
    is_online BOOLEAN DEFAULT FALSE,
    current_location JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for driver_profiles table
CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_online ON driver_profiles(is_online);

-- Create trips table
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID REFERENCES users(id),
    driver_id UUID REFERENCES users(id),
    pickup_location JSONB NOT NULL,
    dropoff_location JSONB NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_address TEXT NOT NULL,
    car_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'in_progress', 'completed', 'cancelled')),
    estimated_price DECIMAL(10,2) NOT NULL,
    final_price DECIMAL(10,2),
    distance_km DECIMAL(10,2),
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for trips table
CREATE INDEX idx_trips_passenger ON trips(passenger_id);
CREATE INDEX idx_trips_driver ON trips(driver_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_created ON trips(created_at DESC);

-- Create trip_status table for tracking trip history
CREATE TABLE trip_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    location JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for trip_status table
CREATE INDEX idx_trip_status_trip ON trip_status(trip_id);
CREATE INDEX idx_trip_status_created ON trip_status(created_at DESC);

-- Create payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for payments table
CREATE INDEX idx_payments_trip ON payments(trip_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Set up Row Level Security (RLS) for trips table
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Create policies for trips table
CREATE POLICY "乘客查看自己的行程" ON trips
    FOR SELECT USING (
        auth.uid() = passenger_id
    );

CREATE POLICY "司機查看自己的行程" ON trips
    FOR SELECT USING (
        auth.uid() = driver_id
    );

CREATE POLICY "乘客創建行程" ON trips
    FOR INSERT WITH CHECK (
        auth.uid() = passenger_id AND 
        status = 'requested'
    );

CREATE POLICY "司機更新行程狀態" ON trips
    FOR UPDATE USING (
        auth.uid() = driver_id
    );

-- Set up permissions for all tables
GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;

GRANT SELECT ON driver_profiles TO anon;
GRANT ALL PRIVILEGES ON driver_profiles TO authenticated;

GRANT SELECT ON trips TO anon;
GRANT ALL PRIVILEGES ON trips TO authenticated;

GRANT SELECT ON trip_status TO anon;
GRANT ALL PRIVILEGES ON trip_status TO authenticated;

GRANT SELECT ON payments TO anon;
GRANT ALL PRIVILEGES ON payments TO authenticated;

-- Enable realtime for trips and trip_status tables
ALTER TABLE trips REPLICA IDENTITY FULL;
ALTER TABLE trip_status REPLICA IDENTITY FULL;

-- Create function to automatically update trip status
CREATE OR REPLACE FUNCTION update_trip_status()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO trip_status (trip_id, status, location)
    VALUES (NEW.id, NEW.status, NEW.current_location);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for trip status updates
CREATE TRIGGER trip_status_update
    AFTER UPDATE OF status ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_trip_status();