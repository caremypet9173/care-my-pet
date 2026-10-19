export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isValidIsoDate(date) {
  return (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}

const ALLOWED_CATEGORIES = new Set(["visit", "vaccination", "prevention"]);

export function validateHealthEvent(input) {
  const errors = {};
  const category = typeof input?.category === "string" ? input.category : "";
  if (!ALLOWED_CATEGORIES.has(category)) {
    errors.category = "invalid_category";
  }

  const title = typeof input?.title === "string" ? input.title.trim() : "";
  if (title.length < 1 || title.length > 120) {
    errors.title = "invalid_title";
  }

  const eventDate = input?.event_date;
  if (
    !isValidIsoDate(eventDate) ||
    eventDate < "1900-01-01" ||
    eventDate > today()
  ) {
    errors.event_date = "invalid_date";
  }

  const rawDue =
    typeof input?.next_due_date === "string" ? input.next_due_date.trim() : "";
  const nextDueDate = rawDue.length ? rawDue : null;
  if (nextDueDate !== null) {
    if (
      !isValidIsoDate(nextDueDate) ||
      nextDueDate > "2100-12-31" ||
      (isValidIsoDate(eventDate) && nextDueDate < eventDate)
    ) {
      errors.next_due_date = "invalid_due_date";
    }
  }

  const clinic = typeof input?.clinic === "string" ? input.clinic.trim() : "";
  if (clinic.length > 120) {
    errors.clinic = "invalid_clinic";
  }

  const doctor = typeof input?.doctor === "string" ? input.doctor.trim() : "";
  if (doctor.length > 120) {
    errors.doctor = "invalid_doctor";
  }

  const batchOrProduct =
    typeof input?.batch_or_product === "string"
      ? input.batch_or_product.trim()
      : "";
  if (batchOrProduct.length > 120) {
    errors.batch_or_product = "invalid_batch_or_product";
  }

  const description =
    typeof input?.description === "string" ? input.description.trim() : "";
  if (description.length > 2000) {
    errors.description = "invalid_description";
  }

  return {
    errors,
    value: Object.keys(errors).length
      ? null
      : {
          category,
          title,
          event_date: eventDate,
          next_due_date: nextDueDate,
          clinic,
          doctor,
          batch_or_product: batchOrProduct,
          description,
        },
  };
}
