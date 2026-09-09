import pino from "pino";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          targets: [
            {
              target: "pino-pretty",
              options: { colorize: true },
              level: "info",
            },
            {
              target: "pino/file",
              options: { destination: path.resolve(__dirname, "..", "..", "telegram-import.log") },
              level: "debug",
            },
          ],
        },
      }),
});
