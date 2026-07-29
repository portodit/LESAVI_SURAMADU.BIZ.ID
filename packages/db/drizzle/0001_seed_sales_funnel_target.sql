-- Seed: sales_funnel_target dari CSV
-- DPS: target_full_ho=97.076M, target_ho=95.973M
-- DSS: target_full_ho=73.780M, target_ho=57.036M
DELETE FROM sales_funnel_target WHERE divisi IN ('DPS', 'DSS') AND tahun = 2026;

INSERT INTO sales_funnel_target (divisi, tahun, bulan, target_full_ho, target_ho)
VALUES
  ('DPS', 2026, NULL, 97076000000::real, 95973000000::real),
  ('DSS', 2026, NULL, 73780000000::real, 57036000000::real);