-- Sample seed data for local/Railway testing

-- Riders
INSERT INTO riders (name, phone, lat, lng)
VALUES 
  ('小明', '0912345678', 25.0478, 121.5319), -- 台北車站
  ('小美', '0922333444', 25.0330, 121.5645), -- 信義區
  ('阿華', '0933555777', 25.0137, 121.4676)  -- 板橋
ON CONFLICT (phone) DO NOTHING;

-- Drivers (ensure some idle with coordinates)
INSERT INTO drivers (name, phone, status, lat, lng, invite_code)
VALUES
  ('阿德', '0955111222', 'idle', 25.0465, 121.5171, '0971827628'),  -- 靠近台北車站
  ('小李', '0955222333', 'idle', 25.0322, 121.5650, '0971827628'),  -- 信義區
  ('老王', '0955333444', 'offline', 25.0627, 121.5220, '0971827628'),
  ('阿明', '0955444555', 'idle', 25.0128, 121.4688, '0971827628')   -- 板橋
ON CONFLICT (phone) DO NOTHING;

-- Example rides (optional)
-- INSERT INTO rides (rider_id, driver_id, status, start_lat, start_lng, end_lat, end_lng)
-- VALUES (1, 1, 'requested', 25.0478, 121.5319, 25.0330, 121.5645);