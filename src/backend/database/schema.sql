-- CS Animation Platform Database Schema

-- Jobs table: stores all render jobs (past, current, failed)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,              -- UUID
  status TEXT NOT NULL,              -- queued, rendering, done, error
  progress INTEGER DEFAULT 0,        -- 0-100
  title TEXT,                        -- User-friendly title
  topic TEXT,                        -- Original AI prompt topic
  manifest TEXT NOT NULL,            -- JSON serialized show manifest
  output_path TEXT,                  -- Path to rendered MP4 file
  error TEXT,                        -- Error message if status=error
  created_at INTEGER NOT NULL,       -- Unix timestamp (milliseconds)
  updated_at INTEGER NOT NULL,       -- Unix timestamp (milliseconds)
  completed_at INTEGER               -- Unix timestamp when done/error
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Templates table (for Phase 6)
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,               -- UUID
  name TEXT NOT NULL,                -- Template name
  description TEXT,                  -- User description
  manifest TEXT NOT NULL,            -- JSON serialized show manifest
  tags TEXT,                         -- Comma-separated tags
  is_public BOOLEAN DEFAULT 0,       -- Public vs private
  created_at INTEGER NOT NULL,       -- Unix timestamp
  updated_at INTEGER NOT NULL        -- Unix timestamp
);

CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC);
