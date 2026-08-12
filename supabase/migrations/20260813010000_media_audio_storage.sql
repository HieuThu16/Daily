insert into storage.buckets (id, name, public) values ('media-audio', 'media-audio', true) on conflict (id) do nothing;
do $$ begin create policy "public media audio read" on storage.objects for select using (bucket_id = 'media-audio'); exception when duplicate_object then null; end $$;
