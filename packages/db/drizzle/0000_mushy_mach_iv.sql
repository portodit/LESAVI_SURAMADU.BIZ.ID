CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "account_managers" (
	"id" serial PRIMARY KEY NOT NULL,
	"nik" text,
	"nama" text NOT NULL,
	"slug" text NOT NULL,
	"email" text,
	"password_hash" text,
	"role" text DEFAULT 'AM' NOT NULL,
	"tipe" text DEFAULT 'LESA',
	"divisi" text DEFAULT 'DPS' NOT NULL,
	"segmen" text,
	"witel" text DEFAULT 'SURAMADU' NOT NULL,
	"jabatan" text,
	"aktif" boolean DEFAULT true NOT NULL,
	"cross_witel" boolean DEFAULT false NOT NULL,
	"telegram_chat_id" text,
	"telegram_code" text,
	"telegram_code_expiry" timestamp with time zone,
	"kpi_activity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_managers_nik_unique" UNIQUE("nik"),
	CONSTRAINT "account_managers_slug_unique" UNIQUE("slug"),
	CONSTRAINT "account_managers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "performance_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"nik" text NOT NULL,
	"nama_am" text NOT NULL,
	"divisi" text NOT NULL,
	"witel_am" text,
	"level_am" text,
	"tahun" integer NOT NULL,
	"bulan" integer NOT NULL,
	"target_revenue" real DEFAULT 0 NOT NULL,
	"real_revenue" real DEFAULT 0 NOT NULL,
	"target_reguler" real DEFAULT 0,
	"real_reguler" real DEFAULT 0,
	"target_sustain" real DEFAULT 0,
	"real_sustain" real DEFAULT 0,
	"target_scaling" real DEFAULT 0,
	"real_scaling" real DEFAULT 0,
	"target_ngtma" real DEFAULT 0,
	"real_ngtma" real DEFAULT 0,
	"ach_rate" real DEFAULT 0 NOT NULL,
	"ach_rate_ytd" real DEFAULT 0 NOT NULL,
	"rank_ach" integer DEFAULT 0 NOT NULL,
	"status_warna" text DEFAULT 'merah' NOT NULL,
	"komponen_detail" text,
	"snapshot_date" text,
	"import_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "am_funnel_target" (
	"id" serial PRIMARY KEY NOT NULL,
	"nik_am" text NOT NULL,
	"tahun" integer NOT NULL,
	"target_value" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "am_funnel_target_nik_tahun" UNIQUE("nik_am","tahun")
);
--> statement-breakpoint
CREATE TABLE "sales_funnel" (
	"id" serial PRIMARY KEY NOT NULL,
	"lopid" text NOT NULL,
	"judul_proyek" text NOT NULL,
	"pelanggan" text NOT NULL,
	"nilai_proyek" real DEFAULT 0 NOT NULL,
	"divisi" text NOT NULL,
	"segmen" text,
	"witel" text,
	"status_f" text,
	"proses" text,
	"status_proyek" text,
	"kategori_kontrak" text,
	"estimate_bulan" text,
	"month_subs" integer,
	"nama_am" text,
	"nik_am" text,
	"report_date" text,
	"created_date" text,
	"snapshot_date" text,
	"import_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_funnel_target" (
	"id" serial PRIMARY KEY NOT NULL,
	"divisi" text,
	"tahun" integer NOT NULL,
	"bulan" integer,
	"target_full_ho" real DEFAULT 0 NOT NULL,
	"target_ho" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"nik" text NOT NULL,
	"fullname" text,
	"divisi" text,
	"segmen" text,
	"regional" text,
	"witel" text,
	"nipnas" text,
	"ca_name" text,
	"activity_type" text,
	"label" text,
	"lopid" text,
	"createdat_activity" text,
	"activity_start_date" text,
	"activity_end_date" text,
	"pic_name" text,
	"pic_jobtitle" text,
	"pic_role" text,
	"pic_phone" text,
	"activity_notes" text,
	"snapshot_date" text,
	"import_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_activity_nik_createdat_unique" UNIQUE("nik","createdat_activity")
);
--> statement-breakpoint
CREATE TABLE "data_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"period" text NOT NULL,
	"snapshot_date" text,
	"source_url" text,
	"auto_telegram_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nik" text NOT NULL,
	"nama_am" text NOT NULL,
	"telegram_chat_id" text,
	"status" text NOT NULL,
	"period" text NOT NULL,
	"message_type" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_bot_users" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"last_message" text DEFAULT '' NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_bot_token" text,
	"sharepoint_performance_url" text,
	"sharepoint_funnel_url" text,
	"sharepoint_activity_url" text,
	"auto_send_on_import" boolean DEFAULT true NOT NULL,
	"kpi_activity_default" integer DEFAULT 30 NOT NULL,
	"g_sheets_spreadsheet_id" text,
	"g_sheets_funnel_spreadsheet_id" text,
	"g_sheets_api_key" text,
	"g_sheets_funnel_pattern" text DEFAULT 'TREG3_SALES_FUNNEL_',
	"g_sheets_sync_enabled" boolean DEFAULT false NOT NULL,
	"g_sheets_sync_hour_wib" integer DEFAULT 6 NOT NULL,
	"g_sheets_sync_interval_days" integer DEFAULT 1 NOT NULL,
	"g_sheets_last_sync_at" timestamp with time zone,
	"g_sheets_last_sync_result" text,
	"g_drive_folder_performance" text,
	"g_drive_folder_funnel" text,
	"g_drive_folder_activity" text,
	"g_drive_folder_target" text,
	"g_drive_sync_enabled" boolean DEFAULT false NOT NULL,
	"g_drive_sync_hour_wib" integer DEFAULT 7 NOT NULL,
	"g_drive_sync_interval_days" integer DEFAULT 1 NOT NULL,
	"g_drive_last_check_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_read_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"folder_id" text,
	"triggered_by" text DEFAULT 'manual' NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"files_found" integer DEFAULT 0 NOT NULL,
	"latest_file_name" text,
	"latest_file_date_extracted" text,
	"existing_snapshot_date" text,
	"condition" text NOT NULL,
	"message" text NOT NULL,
	"rows_imported" integer,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "master_customer" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" text NOT NULL,
	"segmen" text,
	"witel" text DEFAULT 'SURAMADU',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "master_customer_nama_unique" UNIQUE("nama")
);
--> statement-breakpoint
CREATE TABLE "pending_am_discoveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"nik" text NOT NULL,
	"nama" text NOT NULL,
	"divisi" text,
	"witel" text,
	"source" text NOT NULL,
	"import_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
