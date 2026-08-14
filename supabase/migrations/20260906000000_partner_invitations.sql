-- Migration: Bảng partner_invitations để mời và nhận lời mời kết nối kỷ niệm 2 chiều.

create table if not exists public.partner_invitations (
  id             uuid primary key default gen_random_uuid(),
  sender_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_email   text not null,
  receiver_email text not null check (position('@' in receiver_email) > 1),
  status         text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index if not exists partner_invitations_receiver_idx
  on public.partner_invitations(lower(receiver_email), status) where deleted_at is null;

alter table public.partner_invitations enable row level security;

do $$ begin
  create policy "read own or received invitations" on public.partner_invitations for select to authenticated
    using (
      sender_id = auth.uid()
      or lower(receiver_email) = lower(auth.jwt() ->> 'email')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insert own invitations" on public.partner_invitations for insert to authenticated
    with check (sender_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "update received invitations" on public.partner_invitations for update to authenticated
    using (
      sender_id = auth.uid()
      or lower(receiver_email) = lower(auth.jwt() ->> 'email')
    );
exception when duplicate_object then null; end $$;
