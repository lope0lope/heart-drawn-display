create table if not exists public.feed_records (
  id serial primary key,
  pen_id text not null,
  line text not null,
  cycle text not null,
  feed_kg numeric not null,
  croc_count int,
  recorded_date date not null
);

alter table public.feed_records enable row level security;
create policy "Allow public read on feed_records" on public.feed_records for select using (true);
create policy "Allow public insert on feed_records" on public.feed_records for insert with check (true);

create table if not exists public.upload_logs (
  id serial primary key,
  filename text not null,
  record_count int not null,
  status text not null default 'success',
  warnings int default 0,
  uploaded_at timestamptz default now()
);

alter table public.upload_logs enable row level security;
create policy "Allow public read on upload_logs" on public.upload_logs for select using (true);
create policy "Allow public insert on upload_logs" on public.upload_logs for insert with check (true);

insert into public.feed_records (pen_id, line, cycle, feed_kg, croc_count, recorded_date) values
  ('GH1','A','Cycle 1',148,70,'2025-10-01'),('GH1','B','Cycle 1',144,68,'2025-10-01'),('GH1','C','Cycle 1',150,71,'2025-10-01'),
  ('GH1','D','Cycle 1',137,65,'2025-10-01'),('GH1','E','Cycle 1',152,72,'2025-10-01'),('GH1','F','Cycle 1',146,69,'2025-10-01'),
  ('GH1','G','Cycle 1',148,70,'2025-10-01'),('GH1','H','Cycle 1',141,67,'2025-10-01'),('GH1','I','Cycle 1',150,71,'2025-10-01'),
  ('GH1','J','Cycle 1',135,64,'2025-10-01'),('GH1','K','Cycle 1',148,70,'2025-10-01'),('GH1','L','Cycle 1',144,68,'2025-10-01'),
  ('GH1','M','Cycle 1',146,69,'2025-10-01'),
  ('GH1','A','Cycle 2',182,70,'2025-12-01'),('GH1','B','Cycle 2',176,68,'2025-12-01'),('GH1','C','Cycle 2',185,71,'2025-12-01'),
  ('GH1','D','Cycle 2',169,65,'2025-12-01'),('GH1','E','Cycle 2',187,72,'2025-12-01'),('GH1','F','Cycle 2',181,69,'2025-12-01'),
  ('GH1','G','Cycle 2',183,70,'2025-12-01'),('GH1','H','Cycle 2',174,67,'2025-12-01'),('GH1','I','Cycle 2',186,71,'2025-12-01'),
  ('GH1','J','Cycle 2',164,64,'2025-12-01'),('GH1','K','Cycle 2',182,70,'2025-12-01'),('GH1','L','Cycle 2',177,68,'2025-12-01'),
  ('GH1','M','Cycle 2',180,69,'2025-12-01'),
  ('GH1','A','Cycle 3',210,70,'2026-02-01'),('GH1','B','Cycle 3',205,68,'2026-02-01'),('GH1','C','Cycle 3',214,71,'2026-02-01'),
  ('GH1','D','Cycle 3',196,65,'2026-02-01'),('GH1','E','Cycle 3',217,72,'2026-02-01'),('GH1','F','Cycle 3',208,69,'2026-02-01'),
  ('GH1','G','Cycle 3',211,70,'2026-02-01'),('GH1','H','Cycle 3',202,67,'2026-02-01'),('GH1','I','Cycle 3',215,71,'2026-02-01'),
  ('GH1','J','Cycle 3',188,64,'2026-02-01'),('GH1','K','Cycle 3',210,70,'2026-02-01'),('GH1','L','Cycle 3',206,68,'2026-02-01'),
  ('GH1','M','Cycle 3',208,69,'2026-02-01'),
  ('GH2','A','Cycle 1',146,69,'2025-10-01'),('GH2','B','Cycle 1',148,70,'2025-10-01'),('GH2','C','Cycle 1',143,68,'2025-10-01'),
  ('GH2','D','Cycle 1',150,71,'2025-10-01'),('GH2','E','Cycle 1',139,66,'2025-10-01'),('GH2','F','Cycle 1',148,70,'2025-10-01'),
  ('GH2','G','Cycle 1',144,68,'2025-10-01'),('GH2','H','Cycle 1',152,72,'2025-10-01'),('GH2','I','Cycle 1',141,67,'2025-10-01'),
  ('GH2','J','Cycle 1',133,63,'2025-10-01'),('GH2','K','Cycle 1',148,70,'2025-10-01'),('GH2','L','Cycle 1',146,69,'2025-10-01'),
  ('GH2','M','Cycle 1',144,68,'2025-10-01'),
  ('GH2','A','Cycle 2',178,69,'2025-12-01'),('GH2','B','Cycle 2',182,70,'2025-12-01'),('GH2','C','Cycle 2',176,68,'2025-12-01'),
  ('GH2','D','Cycle 2',184,71,'2025-12-01'),('GH2','E','Cycle 2',171,66,'2025-12-01'),('GH2','F','Cycle 2',181,70,'2025-12-01'),
  ('GH2','G','Cycle 2',177,68,'2025-12-01'),('GH2','H','Cycle 2',188,72,'2025-12-01'),('GH2','I','Cycle 2',173,67,'2025-12-01'),
  ('GH2','J','Cycle 2',162,63,'2025-12-01'),('GH2','K','Cycle 2',182,70,'2025-12-01'),('GH2','L','Cycle 2',180,69,'2025-12-01'),
  ('GH2','M','Cycle 2',177,68,'2025-12-01'),
  ('GH2','A','Cycle 3',207,69,'2026-02-01'),('GH2','B','Cycle 3',210,70,'2026-02-01'),('GH2','C','Cycle 3',204,68,'2026-02-01'),
  ('GH2','D','Cycle 3',213,71,'2026-02-01'),('GH2','E','Cycle 3',199,66,'2026-02-01'),('GH2','F','Cycle 3',210,70,'2026-02-01'),
  ('GH2','G','Cycle 3',205,68,'2026-02-01'),('GH2','H','Cycle 3',218,72,'2026-02-01'),('GH2','I','Cycle 3',201,67,'2026-02-01'),
  ('GH2','J','Cycle 3',185,63,'2026-02-01'),('GH2','K','Cycle 3',210,70,'2026-02-01'),('GH2','L','Cycle 3',208,69,'2026-02-01'),
  ('GH2','M','Cycle 3',206,68,'2026-02-01');
