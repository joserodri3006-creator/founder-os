const EMAIL_PROGRESS_STATUSES = new Set(["follow_up", "nachgefasst"]);

function statusAfterSuccessfulEmailSend(currentStatus) {
  if (currentStatus === "neu" || currentStatus === "in_bearbeitung") return "kontaktiert";
  if (currentStatus === "kontaktiert") return "follow_up";
  if (currentStatus === "follow_up") return "nachgefasst";
  return currentStatus;
}

function canSetStatusWithoutEmailSend(nextStatus) {
  return !EMAIL_PROGRESS_STATUSES.has(nextStatus);
}

function normalizeMailFolder(folder) {
  const value = String(folder || "INBOX").trim().toLowerCase();
  if (["sent", "sent mail", "gesendet", "gesendete objekte", "gesendete elemente", "[gmail]/sent mail"].includes(value)) return "sent";
  if (["drafts", "draft", "entwürfe", "entwuerfe", "[gmail]/drafts"].includes(value)) return "drafts";
  return "INBOX";
}

function mailKind(folder) {
  const normalized = normalizeMailFolder(folder);
  if (normalized === "sent") return "sent";
  if (normalized === "drafts") return "draft";
  return "received";
}

module.exports = {
  statusAfterSuccessfulEmailSend,
  canSetStatusWithoutEmailSend,
  mailKind,
};
