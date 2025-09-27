alter table public.nodes
  add column if not exists conversation jsonb default '[]'::jsonb;

comment on column public.nodes.conversation is 'Serialized conversation history for the node (array of {role, text, status, timestamp, metadata}).';
