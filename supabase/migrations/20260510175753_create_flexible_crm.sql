create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid null references public.bots(id) on delete cascade,
  scope text not null default 'global' check (scope in ('global', 'bot')),
  name text not null default 'CRM',
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint crm_pipelines_scope_bot_check check (
    (scope = 'global' and bot_id is null) or
    (scope = 'bot' and bot_id is not null)
  )
);

create table if not exists public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  key text not null,
  name text not null,
  color text not null default '#38bdf8',
  sort_order integer not null default 0,
  is_terminal boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.crm_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  key text not null,
  name text not null,
  type text not null default 'text' check (
    type in ('text', 'textarea', 'number', 'date', 'datetime', 'phone', 'email', 'select', 'checkbox')
  ),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.crm_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid null references public.bots(id) on delete set null,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  stage_id uuid not null references public.crm_stages(id) on delete restrict,
  title text not null,
  external_key text null,
  telegram_user_id bigint null,
  telegram_chat_id bigint null,
  field_values jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}'::text[],
  notes text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  stage_updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.crm_card_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid null references public.bots(id) on delete set null,
  card_id uuid not null references public.crm_cards(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists crm_pipelines_global_default_unique on public.crm_pipelines(user_id) where scope = 'global' and is_default;

create unique index if not exists crm_pipelines_bot_default_unique on public.crm_pipelines(user_id, bot_id) where scope = 'bot' and is_default;

create unique index if not exists crm_stages_pipeline_key_unique on public.crm_stages(pipeline_id, key);

create unique index if not exists crm_fields_pipeline_key_unique on public.crm_fields(pipeline_id, key);

create unique index if not exists crm_cards_pipeline_external_key_unique on public.crm_cards(pipeline_id, external_key) where external_key is not null and btrim(external_key) <> '';

create index if not exists crm_cards_user_updated_idx on public.crm_cards(user_id, updated_at desc);

create index if not exists crm_cards_bot_updated_idx on public.crm_cards(bot_id, updated_at desc);

create index if not exists crm_cards_stage_idx on public.crm_cards(stage_id);

create index if not exists crm_card_events_card_created_idx on public.crm_card_events(card_id, created_at desc);

alter table public.crm_pipelines enable row level security;
alter table public.crm_stages enable row level security;
alter table public.crm_fields enable row level security;
alter table public.crm_cards enable row level security;
alter table public.crm_card_events enable row level security;

drop policy if exists "crm_pipelines_owner_select" on public.crm_pipelines;
create policy "crm_pipelines_owner_select"
  on public.crm_pipelines for select
  using (user_id = auth.uid());

drop policy if exists "crm_pipelines_owner_insert" on public.crm_pipelines;
create policy "crm_pipelines_owner_insert"
  on public.crm_pipelines for insert
  with check (user_id = auth.uid());

drop policy if exists "crm_pipelines_owner_update" on public.crm_pipelines;
create policy "crm_pipelines_owner_update"
  on public.crm_pipelines for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_pipelines_owner_delete" on public.crm_pipelines;
create policy "crm_pipelines_owner_delete"
  on public.crm_pipelines for delete
  using (user_id = auth.uid());

drop policy if exists "crm_stages_owner_select" on public.crm_stages;
create policy "crm_stages_owner_select"
  on public.crm_stages for select
  using (user_id = auth.uid());

drop policy if exists "crm_stages_owner_insert" on public.crm_stages;
create policy "crm_stages_owner_insert"
  on public.crm_stages for insert
  with check (user_id = auth.uid());

drop policy if exists "crm_stages_owner_update" on public.crm_stages;
create policy "crm_stages_owner_update"
  on public.crm_stages for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_stages_owner_delete" on public.crm_stages;
create policy "crm_stages_owner_delete"
  on public.crm_stages for delete
  using (user_id = auth.uid());

drop policy if exists "crm_fields_owner_select" on public.crm_fields;
create policy "crm_fields_owner_select"
  on public.crm_fields for select
  using (user_id = auth.uid());

drop policy if exists "crm_fields_owner_insert" on public.crm_fields;
create policy "crm_fields_owner_insert"
  on public.crm_fields for insert
  with check (user_id = auth.uid());

drop policy if exists "crm_fields_owner_update" on public.crm_fields;
create policy "crm_fields_owner_update"
  on public.crm_fields for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_fields_owner_delete" on public.crm_fields;
create policy "crm_fields_owner_delete"
  on public.crm_fields for delete
  using (user_id = auth.uid());

drop policy if exists "crm_cards_owner_select" on public.crm_cards;
create policy "crm_cards_owner_select"
  on public.crm_cards for select
  using (user_id = auth.uid());

drop policy if exists "crm_cards_owner_insert" on public.crm_cards;
create policy "crm_cards_owner_insert"
  on public.crm_cards for insert
  with check (user_id = auth.uid());

drop policy if exists "crm_cards_owner_update" on public.crm_cards;
create policy "crm_cards_owner_update"
  on public.crm_cards for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "crm_cards_owner_delete" on public.crm_cards;
create policy "crm_cards_owner_delete"
  on public.crm_cards for delete
  using (user_id = auth.uid());

drop policy if exists "crm_card_events_owner_select" on public.crm_card_events;
create policy "crm_card_events_owner_select"
  on public.crm_card_events for select
  using (user_id = auth.uid());

drop policy if exists "crm_card_events_owner_insert" on public.crm_card_events;
create policy "crm_card_events_owner_insert"
  on public.crm_card_events for insert
  with check (user_id = auth.uid());

insert into public.crm_pipelines (user_id, bot_id, scope, name, is_default)
select distinct b.user_id, null::uuid, 'global', 'Общая CRM', true
from public.bots b
on conflict do nothing;

insert into public.crm_pipelines (user_id, bot_id, scope, name, is_default)
select b.user_id, b.id, 'bot', coalesce(nullif(b.name, ''), 'Бот') || ' CRM', true
from public.bots b
on conflict do nothing;

insert into public.crm_stages (user_id, pipeline_id, key, name, color, sort_order, is_terminal)
select p.user_id, p.id, stage.key, stage.name, stage.color, stage.sort_order, stage.is_terminal
from public.crm_pipelines p
cross join (
  values
    ('new', 'Новая', '#38bdf8', 10, false),
    ('in_progress', 'В работе', '#8b5cf6', 20, false),
    ('waiting', 'Ожидает', '#f59e0b', 30, false),
    ('won', 'Успешно', '#10b981', 40, true),
    ('lost', 'Потеряно', '#ef4444', 50, true)
) as stage(key, name, color, sort_order, is_terminal)
on conflict do nothing;

insert into public.crm_fields (user_id, pipeline_id, key, name, type, options, required, sort_order)
select p.user_id, p.id, field.key, field.name, field.type, '[]'::jsonb, false, field.sort_order
from public.crm_pipelines p
cross join (
  values
    ('name', 'Имя', 'text', 10),
    ('phone', 'Телефон', 'phone', 20),
    ('comment', 'Комментарий', 'textarea', 30),
    ('date_time', 'Дата/время', 'datetime', 40),
    ('amount', 'Сумма', 'number', 50)
) as field(key, name, type, sort_order)
on conflict do nothing;

insert into public.crm_cards (
  user_id,
  bot_id,
  pipeline_id,
  stage_id,
  title,
  external_key,
  telegram_user_id,
  telegram_chat_id,
  field_values,
  tags,
  notes,
  created_at,
  updated_at,
  stage_updated_at
)
select
  b.user_id,
  s.bot_id,
  p.id,
  st.id,
  coalesce(
    nullif(trim(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''))), ''),
    nullif('@' || coalesce(s.username, ''), '@'),
    'Telegram ' || s.telegram_user_id::text
  ) as title,
  'subscriber:' || s.telegram_user_id::text as external_key,
  s.telegram_user_id,
  s.telegram_chat_id,
  jsonb_build_object(
    'name', coalesce(nullif(trim(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''))), ''), coalesce(s.username, '')),
    'phone', '',
    'comment', coalesce(s.lead_notes, ''),
    'date_time', coalesce(s.last_seen_at, s.first_seen_at),
    'amount', null,
    'username', s.username,
    'languageCode', s.language_code
  ),
  coalesce(s.lead_tags, '{}'::text[]),
  s.lead_notes,
  coalesce(s.first_seen_at, timezone('utc'::text, now())),
  coalesce(s.last_seen_at, timezone('utc'::text, now())),
  coalesce(s.lead_stage_updated_at, s.last_seen_at, s.first_seen_at, timezone('utc'::text, now()))
from public.bot_subscribers s
join public.bots b on b.id = s.bot_id
join public.crm_pipelines p on p.user_id = b.user_id and p.bot_id = s.bot_id and p.scope = 'bot' and p.is_default
join public.crm_stages st on st.pipeline_id = p.id and st.key = case coalesce(s.lead_stage, 'new')
  when 'contacted' then 'in_progress'
  when 'qualified' then 'waiting'
  when 'won' then 'won'
  when 'lost' then 'lost'
  else 'new'
end
on conflict do nothing;

insert into public.crm_card_events (user_id, bot_id, card_id, event_type, payload, created_at)
select
  c.user_id,
  c.bot_id,
  c.id,
  'backfill_subscriber',
  jsonb_build_object(
    'telegramUserId', c.telegram_user_id,
    'source', 'bot_subscribers'
  ),
  c.created_at
from public.crm_cards c
where c.external_key like 'subscriber:%'
on conflict do nothing;

notify pgrst, 'reload schema';
