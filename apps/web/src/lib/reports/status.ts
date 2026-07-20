export const REPORT_STATUS_VALUES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
  "duplicate",
] as const;

export type ReportStatusValue = (typeof REPORT_STATUS_VALUES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatusValue, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
  duplicate: "Duplicate",
};

export const REPORT_STATUS_BY_DIGIT: Record<string, ReportStatusValue> = {
  "1": "open",
  "2": "in_progress",
  "3": "resolved",
  "4": "closed",
  "5": "duplicate",
};
