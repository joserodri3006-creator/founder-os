export type LeadMailKind = "received" | "sent" | "draft";

export function statusAfterSuccessfulEmailSend(currentStatus: string): string;
export function canSetStatusWithoutEmailSend(nextStatus: string): boolean;
export function mailKind(folder: string | null | undefined): LeadMailKind;
