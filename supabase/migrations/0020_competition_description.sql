-- Every competition organizers create can now carry a short public
-- description -- shown on its public page so a visitor understands
-- what the competition actually is before scrolling to standings.
-- Purely additive/optional, no existing row or function breaks.

alter table competitions add column description text;
