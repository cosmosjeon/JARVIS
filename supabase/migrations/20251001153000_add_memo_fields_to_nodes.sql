-- Add memo support columns to nodes table
alter table public.nodes
  add column if not exists node_type text default 'question';

alter table public.nodes
  add column if not exists memo_parent_id text references public.nodes(id) on delete cascade;

alter table public.nodes
  add column if not exists memo_title text;

alter table public.nodes
  add column if not exists memo_content text;

alter table public.nodes
  add column if not exists memo_metadata jsonb;

update public.nodes
set node_type = coalesce(nullif(node_type, ''), 'question');

alter table public.nodes
  alter column node_type set not null;

alter table public.nodes
  drop constraint if exists nodes_node_type_check;

alter table public.nodes
  add constraint nodes_node_type_check check (node_type in ('question','memo'));

alter table public.nodes
  drop constraint if exists nodes_status_check;

alter table public.nodes
  add constraint nodes_status_check check (status in ('placeholder','asking','answered','draft','memo'));

create index if not exists nodes_memo_parent_idx on public.nodes(memo_parent_id);

-- Ensure memo nodes default to question when unspecified
alter table public.nodes
  alter column node_type set default 'question';
