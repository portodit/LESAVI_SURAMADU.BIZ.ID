import { sendReminderToAllAMs } from "./service";
import { logger } from "../../shared/logger";

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

const WEDNESDAY_WIB = 3; // JS day: 0 Sun ... 3 Wed
const HOUR_WIB = 9;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function nextWednesdayRunTime(hourWib: number): Date {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const now = new Date();
  const nowWib = new Date(now.getTime() + WIB_OFFSET_MS);

  const candidate = new Date(nowWib);
  candidate.setUTCHours(hourWib, 0, 0, 0);

  const dayDiff = (WEDNESDAY_WIB - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + dayDiff);

  if (candidate <= nowWib) {
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }

  return new Date(candidate.getTime() - WIB_OFFSET_MS);
}

async function tick() {
  logger.info("Telegram weekly funnel auto-send triggered");

  try {
    const period = currentPeriod();
    const result = await sendReminderToAllAMs(period, {
      includePerformance: false,
      includeFunnel: true,
      includeActivity: false,
    });

    logger.info(
      {
        period,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
      },
      "Telegram weekly funnel auto-send complete"
    );
  } catch (err) {
    logger.error({ err }, "Telegram weekly funnel auto-send failed");
  }

  scheduleNext();
}

async function scheduleNext() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  try {
    const runAt = nextWednesdayRunTime(HOUR_WIB);
    const delayMs = runAt.getTime() - Date.now();

    logger.info(
      { runAt: runAt.toISOString(), delayMs, dayWib: "Wednesday", hourWib: HOUR_WIB },
      "Telegram weekly funnel auto-send scheduled"
    );

    schedulerTimer = setTimeout(tick, delayMs);
  } catch (err) {
    logger.error({ err }, "Failed to schedule Telegram weekly funnel auto-send");
  }
}

export function startTelegramWeeklyFunnelScheduler() {
  scheduleNext();
}

export function rescheduleTelegramWeeklyFunnelScheduler() {
  scheduleNext();
}
