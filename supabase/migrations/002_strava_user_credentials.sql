-- Migration 002: strava per-user credentials
-- Each Pro user provides their own Strava app credentials obtained from strava.com/settings/api
-- Run in Supabase SQL editor: supabase.com/dashboard/project/luqpjgzpydquqturgjmt/editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS strava_client_id text,
  ADD COLUMN IF NOT EXISTS strava_client_secret text;
