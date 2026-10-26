import { formatDate } from "./utils";

export type SignaturePerson = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type CloseTechnicianSignature = {
  name: string | null;
  dateLabel: string | null;
};

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function clean(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function initialOf(first: string): string {
  const ch = Array.from(first)[0] || "";
  return ch.toLocaleUpperCase("en-US");
}

function isSuffix(token: string): boolean {
  return NAME_SUFFIXES.has(token.toLowerCase().replace(/\./g, ""));
}

/** "Travis Woods" → "T. Woods". A single name is kept as written. */
export function printedTechName(
  person: SignaturePerson | string | null | undefined
): string | null {
  if (person == null) return null;
  if (typeof person === "string") return printedNameFromText(person);

  const first = clean(person.firstName);
  const last = clean(person.lastName);
  if (first && last) return `${initialOf(first)}. ${last}`;

  const fromDisplay = printedNameFromText(person.name);
  if (fromDisplay) return fromDisplay;
  if (first) return first;
  if (last) return last;
  return null;
}

function printedNameFromText(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;

  if (raw.includes(",")) {
    const [lastPart, rest] = raw.split(",", 2);
    const last = clean(lastPart);
    const first = clean(rest).split(" ")[0] || "";
    if (first && last) return `${initialOf(first)}. ${last}`;
    return first || last || null;
  }

  const tokens = raw.split(" ").filter(Boolean);
  while (tokens.length > 1 && isSuffix(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return tokens[0];
  return `${initialOf(tokens[0])}. ${tokens[tokens.length - 1]}`;
}

function closeDateLabel(
  value: Date | string | null | undefined
): string | null {
  if (value == null || value === "") return null;
  const label = formatDate(value);
  return label === "—" ? null : label;
}

function recordedPerson(
  person: SignaturePerson | null | undefined
): SignaturePerson | null {
  if (!person) return null;
  return printedTechName(person) ? person : null;
}

/**
 * Printed technician line for a closed work order.
 * PM uses the technician chosen at close. CM uses the technician recorded
 * on the work order, then the person who closed it.
 * Open work orders return null so the signature line stays blank.
 */
export function closeTechnicianSignature(input: {
  status: string;
  type: string;
  dateClosed: Date | string | null | undefined;
  assignedTech?: SignaturePerson | null;
  closedBy?: SignaturePerson | null;
}): CloseTechnicianSignature | null {
  if (String(input.status || "").toUpperCase() !== "CLOSED") return null;

  const person =
    input.type === "CM"
      ? recordedPerson(input.assignedTech) ?? input.closedBy ?? null
      : input.assignedTech ?? null;
  const name = printedTechName(person);
  const dateLabel = closeDateLabel(input.dateClosed);
  if (!name && !dateLabel) return null;
  return { name, dateLabel };
}
