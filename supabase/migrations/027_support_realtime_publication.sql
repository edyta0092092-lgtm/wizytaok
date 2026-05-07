-- Ensure support chat tables are present in Supabase Realtime publication.

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_conversations;
  exception
    when duplicate_object then
      null;
  end;
end
$$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception
    when duplicate_object then
      null;
  end;
end
$$;
