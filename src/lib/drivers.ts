import type { Driver } from "@/core/model/schema";

export const DRIVER_LABELS: Record<Driver, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

export const DRIVER_OPTIONS = (Object.keys(DRIVER_LABELS) as Driver[]).map((driver) => ({
  value: driver,
  label: DRIVER_LABELS[driver],
}));
