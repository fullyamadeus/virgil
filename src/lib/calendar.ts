export type TermDates = { label: string; starts_on: string; ends_on: string };
export type ExamWeekDates = { starts_on: string; ends_on: string };

export function classDateBounds(term: TermDates) {
  const startYear = Number(term.starts_on.slice(0, 4));
  const startMonth = Number(term.starts_on.slice(5, 7));
  const summer = /summer/i.test(term.label) || (!/winter/i.test(term.label) && startMonth < 7);
  const academicYear = summer && startMonth >= 8 ? startYear + 1 : startYear;
  return summer
    ? { starts_on: `${academicYear}-02-18`, ends_on: `${academicYear}-05-31` }
    : { starts_on: `${startYear}-10-01`, ends_on: `${startYear}-12-31` };
}

export function recurringClassVisible(date: string, term: TermDates, weeks: ExamWeekDates[]) {
  const bounds = classDateBounds(term);
  if (date < term.starts_on || date > term.ends_on || date < bounds.starts_on || date > bounds.ends_on) return false;
  const ordered = [...weeks].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (ordered.some(week => week.starts_on <= date && date <= week.ends_on)) return false;
  return !(ordered[1] && date >= ordered[1].starts_on);
}
