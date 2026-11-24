const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const underThousandInWords = (value) => {
  const amount = Math.trunc(value);
  const parts = [];
  if (amount >= 100) parts.push(`${ones[Math.trunc(amount / 100)]} Hundred`);
  const remainder = amount % 100;
  if (remainder >= 20) parts.push(`${tens[Math.trunc(remainder / 10)]}${remainder % 10 ? ` ${ones[remainder % 10]}` : ""}`);
  else if (remainder > 0) parts.push(ones[remainder]);
  return parts.join(" ");
};

const indianNumberInWords = (value) => {
  const amount = Math.trunc(Math.abs(value));
  if (amount === 0) return "Zero";
  const groups = [[10_000_000, "Crore"], [100_000, "Lakh"], [1_000, "Thousand"]];
  let remainder = amount;
  const parts = [];
  groups.forEach(([divisor, label]) => {
    const group = Math.trunc(remainder / divisor);
    if (group) parts.push(`${underThousandInWords(group)} ${label}`);
    remainder %= divisor;
  });
  if (remainder) parts.push(underThousandInWords(remainder));
  return parts.join(" ");
};

const currencyLabels = {
  INR: { major: "Rupees", minor: "Paise" },
  USD: { major: "US Dollars", minor: "Cents" },
  EUR: { major: "Euros", minor: "Cents" },
  GBP: { major: "Pounds", minor: "Pence" },
};

export const amountInWords = (value, currencyCode = "INR") => {
  const numericValue = Number(value);
  const normalized = Number.isFinite(numericValue) ? numericValue : 0;
  const roundedInMinorUnits = Math.round(Math.abs(normalized) * 100);
  const major = Math.trunc(roundedInMinorUnits / 100);
  const minor = roundedInMinorUnits % 100;
  const currency = currencyLabels[String(currencyCode || "INR").trim().toUpperCase()] || {
    major: String(currencyCode || "Amount").trim().toUpperCase(),
    minor: "Cents",
  };
  const decimals = minor ? ` and ${indianNumberInWords(minor)} ${currency.minor}` : "";
  return `${normalized < 0 ? "Minus " : ""}${currency.major} ${indianNumberInWords(major)}${decimals} Only`;
};
