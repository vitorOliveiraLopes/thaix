-- Schema mínimo para testar supabase/sql/coach_phase3.sql num Postgres local.
-- Uso: createdb t; psql -d t -f mock_schema.sql; psql -d t -f ../sql/coach_phase3.sql; psql -d t -f coach_phase3.test.sql
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create table skill_exercises(id uuid primary key default gen_random_uuid(), skill_id text, exercise_name text, category text, level text, sets int, reps int, time_sec int, rest_sec int default 60, note text, order_index int default 0, equipment text[] default '{}');
create table user_skill_progress(user_id uuid, skill_id text, level text, week_number int, sessions_at_current_level int, level_updated_at timestamptz, updated_at timestamptz, primary key(user_id, skill_id));
create table onboarding_responses(user_id uuid primary key, skills text[], focus_skill_id text);
create table skill_level_history(user_id uuid, skill_id text, from_level text, to_level text, week_number int, changed_at timestamptz);
create table daily_workouts(id uuid primary key default gen_random_uuid(), user_id uuid, skill_id text, date date, week_number int, completed_at timestamptz, adjusted boolean default false, unique(user_id, skill_id, date));
create table daily_workout_items(daily_workout_id uuid references daily_workouts(id), skill_exercise_id uuid, order_index int, sets int, reps int, time_sec int, primary key(daily_workout_id, order_index));
grant usage on schema public, auth to authenticated;
