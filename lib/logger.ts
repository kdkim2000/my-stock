type LogMeta = Record<string, unknown> | unknown;

function formatMeta(meta?: LogMeta): string {
  if (meta === undefined) return "";
  try {
    return " " + JSON.stringify(meta);
  } catch {
    return " [unserializable]";
  }
}

function emit(level: "INFO" | "WARN" | "ERROR" | "DEBUG", tag: string, msg: string, meta?: LogMeta) {
  const line = `[${new Date().toISOString()}] [${level}] [${tag}] ${msg}${formatMeta(meta)}`;
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);
}

export function createLogger(tag: string) {
  return {
    info: (msg: string, meta?: LogMeta) => emit("INFO", tag, msg, meta),
    warn: (msg: string, meta?: LogMeta) => emit("WARN", tag, msg, meta),
    error: (msg: string, meta?: LogMeta) => emit("ERROR", tag, msg, meta),
    debug: (msg: string, meta?: LogMeta) => {
      if (process.env.NODE_ENV === "development") emit("DEBUG", tag, msg, meta);
    },
  };
}

export const logger = createLogger("App");
