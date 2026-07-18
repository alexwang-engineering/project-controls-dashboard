import { format, parseISO } from "date-fns";

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentage = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1,
});

export const formatCurrency = (value: number) => currency.format(value);
export const formatCompactCurrency = (value: number) =>
  compactCurrency.format(value);
export const formatPercent = (value: number | null) =>
  value === null ? "Not available" : percentage.format(value);
export const formatIndex = (value: number | null) =>
  value === null ? "N/A" : value.toFixed(3);
export const formatDate = (value: string) =>
  format(parseISO(value), "d MMM yyyy");
