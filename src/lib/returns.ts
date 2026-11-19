export type ReturnReason = "damaged" | "wrong_item" | "missing_item" | "not_as_described" | "other";
export type ReturnStatus = "requested" | "approved" | "rejected" | "escalated" | "completed" | "cancelled";

export const RETURN_REASONS: Record<ReturnReason, string> = {
  damaged: "Item Arrived Damaged",
  wrong_item: "Received the Wrong Item",
  missing_item: "Item Is Missing",
  not_as_described: "Not as Described",
  other: "Other Problem",
};
/** These reasons need at least one photo (food usually can't be sent back, so the photo is the evidence). */
export const PHOTO_REQUIRED: ReturnReason[] = ["damaged", "wrong_item", "not_as_described"];

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: "Waiting for the Store", approved: "Approved", rejected: "Declined by the Store",
  escalated: "With LOOKBAN", completed: "Completed", cancelled: "Withdrawn",
};
export const RETURN_STATUS_TONE: Record<ReturnStatus, string> = {
  requested: "bg-yellow text-dark", approved: "bg-blue-50 text-brand", rejected: "bg-red-100 text-red-800",
  escalated: "bg-orange-50 text-orange", completed: "bg-green-100 text-green-900", cancelled: "bg-line text-muted",
};
export const EVENT_LABEL: Record<string, string> = {
  requested: "Request sent", rejected: "Declined", approved: "Approved", escalated: "Escalated to LOOKBAN",
  withdrawn: "Withdrawn by customer", refund_recorded: "Refund recorded", replacement_arranged: "Replacement arranged",
};
export const ACTOR_LABEL = { customer: "Customer", store: "Store", admin: "LOOKBAN" } as const;

export const RETURN_PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const RETURN_PHOTO_MAX = 5 * 1024 * 1024;
export const RETURN_PHOTO_COUNT = 3;
