-- Migration: seed account_managers, am_funnel_target, sales_funnel_target
-- Generated at 2026-04-30
-- Run each table separately to avoid multi-conflict issues

-- ── account_managers ──────────────────────────────────────────────────────────
INSERT INTO "account_managers" ("id","nik","nama","slug","email","password_hash","role","tipe","divisi","segmen","witel","jabatan","aktif","cross_witel","telegram_chat_id","telegram_code","telegram_code_expiry","kpi_activity","created_at","discovered_from")
VALUES
  (1,'401431','NYARI KUSUMANINGRUM','nyari-kusumaningrum',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','true',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.056Z',NULL),
  (2,'402478','ANA RUKMANA','ana-rukmana',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.062Z',NULL),
  (3,'403613','NADYA ZAHROTUL HAYATI','nadya-zahrotul-hayati',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.065Z',NULL),
  (4,'404429','WILDAN ARIEF','wildan-arief',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','true',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.067Z',NULL),
  (6,'405690','CAESAR RIO ANGGINA TORUAN','caesar-rio-anggina-toruan',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.073Z',NULL),
  (8,'870022','HAVEA PERTIWI','havea-pertiwi',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.079Z',NULL),
  (9,'896661','NI MADE NOVI WIRANA','ni-made-novi-wirana',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.082Z',NULL),
  (10,'910017','SAFIRINA FEBRYANTI','safirina-febryanti',NULL,NULL,'AM','LESA','DSS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.085Z',NULL),
  (11,'910024','VIVIN VIOLITA','vivin-violita',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.088Z',NULL),
  (12,'920064','ERVINA HANDAYANI','ervina-handayani',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.091Z',NULL),
  (13,'980067','HANDIKA DAGNA NEVANDA','handika-dagna-nevanda',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'true','true',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.094Z',NULL),
  (14,'850099','RENI WULANSARI','reni-wulansari',NULL,NULL,'MANAGER','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,'0','2026-03-31T03:26:33.097Z',NULL),
  (15,'160203','Admin Officer','officer-bliadiitdev','bliadiitdev@gmail.com','$2b$10$ucAam8hy6a5YHcMbJ6yUv.ncLN/AUskcX4YpRilQG0Hy9v3HU3zHi','OFFICER','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,NULL,'2026-03-31T03:26:33.100Z',NULL),
  (1139,'950160','DIAN ING TYAS DANANJAYA','dian-ing-tyas-dananjaya',NULL,NULL,'OFFICER','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,'0','2026-04-09T09:59:12.454Z',NULL),
  (1140,'980134','AYU KIRANA','ayu-kirana',NULL,NULL,'OFFICER','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,'0','2026-04-09T09:59:12.454Z',NULL),
  (1141,'940094','KARENDIYA KINASIH','karendiya-kinasih',NULL,NULL,'OFFICER','LESA','DPS',NULL,'SURAMADU',NULL,'true','false',NULL,NULL,NULL,'0','2026-04-10T00:23:58.288Z',NULL),
  (1284,'405075','KATATA VEKANIDYA SEKAR PUSPITASARI','katata-vekanidya-sekar-puspitasari',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'false','false',NULL,NULL,NULL,'30','2026-04-10T00:23:58.288Z','seeder'),
  (1290,'850046','MOH RIZAL BIN MOH. FERRY Y.P. DARA','moh-rizal-bin-moh-ferry-yp-dara',NULL,NULL,'AM','LESA','DPS',NULL,'SURAMADU',NULL,'false','false',NULL,NULL,NULL,'30','2026-04-10T00:23:58.293Z','seeder')
ON CONFLICT (id) DO NOTHING;

-- ── am_funnel_target ─────────────────────────────────────────────────────────
INSERT INTO "am_funnel_target" ("id","nik_am","tahun","target_value","created_at","updated_at","target_value_dss","target_value_dps")
VALUES
  (1,'870022','2026','30550845000','2026-04-06T08:21:02.613Z','2026-04-30T09:27:50.271Z','11909818000','18641027000'),
  (2,'910017','2026','29986554000','2026-04-06T08:21:02.920Z','2026-04-30T09:27:50.278Z','29344076000','642477440'),
  (3,'910024','2026','20271671000','2026-04-06T08:21:02.925Z','2026-04-30T09:27:50.282Z','8041920000','12229752000'),
  (4,'920064','2026','18168530000','2026-04-06T08:21:02.929Z','2026-04-30T09:27:50.286Z','863020200','17305510000'),
  (5,'896661','2026','16919356000','2026-04-06T08:21:02.934Z','2026-04-30T09:27:50.291Z','3409123000','13510234000'),
  (6,'980067','2026','15051480000','2026-04-06T08:21:02.939Z','2026-04-30T09:27:50.295Z','8575435300','6476045000'),
  (7,'404429','2026','12150697000','2026-04-06T08:21:03.056Z','2026-04-30T09:27:50.298Z','10277747000','1872950100'),
  (8,'401431','2026','10517836000','2026-04-06T08:21:03.061Z','2026-04-30T09:27:50.303Z','2564608300','7953228000'),
  (9,'403613','2026','9265053000','2026-04-06T08:21:03.065Z','2026-04-30T09:27:50.307Z','0','9265053000'),
  (10,'405690','2026','9232103000','2026-04-06T08:21:03.070Z','2026-04-30T09:27:50.315Z','1018147100','8213956600'),
  (11,'402478','2026','2386441500','2026-04-06T08:21:03.074Z','2026-04-30T09:27:50.322Z','1921132900','465308500')
ON CONFLICT (nik_am, tahun) DO NOTHING;

-- ── sales_funnel_target (bulan is NULL in source data) ────────────────────────
INSERT INTO "sales_funnel_target" ("id","divisi","tahun","bulan","target_full_ho","target_ho","created_at")
VALUES
  (1,'DPS','2026',NULL,'97076000000','95973000000','2026-03-31T03:26:33.106Z'),
  (2,'DSS','2026',NULL,'73780000000','57036000000','2026-03-31T03:26:33.109Z')
ON CONFLICT (id) DO NOTHING;
