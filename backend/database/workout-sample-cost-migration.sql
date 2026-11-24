ALTER TABLE marketing_workouts
  ADD COLUMN sample_cost_percent DECIMAL(7,4) NOT NULL DEFAULT 0 AFTER trial_cost_inr,
  ADD COLUMN sample_cost_inr DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER sample_cost_percent;
