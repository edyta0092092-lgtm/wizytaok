-- Błąd aplikacji: column business_members.staff_member_id does not exist
-- (migracja 013 nie była uruchomiona w tym projekcie Supabase).

alter table public.business_members
  add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null;

create index if not exists business_members_staff_member_id_idx
  on public.business_members (staff_member_id);

alter table public.business_invitations
  add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null;

create index if not exists business_invitations_staff_member_id_idx
  on public.business_invitations (staff_member_id);
