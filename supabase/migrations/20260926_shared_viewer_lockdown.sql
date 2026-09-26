-- A viewer cannot change their passenger row within a shared trip.
-- Owners and editors retain the trip-wide passengers edit policy.
drop policy if exists "passenger update self" on public.passengers;
