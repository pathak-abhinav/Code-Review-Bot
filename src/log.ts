/** JSON-friendly logs for CloudWatch / App Runner (stdout). */

export interface LogFields {
  correlationId?: string;
  event?: string;
  [key: string]: unknown;
}

export function logInfo(message: string, fields: LogFields = {}): void {
  console.log(JSON.stringify({ level: "info", msg: message, ...fields }));
}

export function logWarn(message: string, fields: LogFields = {}): void {
  console.warn(JSON.stringify({ level: "warn", msg: message, ...fields }));
}

export function logError(message: string, fields: LogFields = {}): void {
  console.error(JSON.stringify({ level: "error", msg: message, ...fields }));
}
