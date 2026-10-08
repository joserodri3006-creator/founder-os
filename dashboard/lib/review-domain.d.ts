export type ReviewValidationResult =
  | { ok: false; error: string }
  | {
      ok: true;
      value: {
        rating: number;
        title: string | null;
        body: string;
        author_name: string | null;
        author_display_name: string;
        public_consent: boolean;
      };
    };

export function hashReviewToken(token: string): string;
export function publicReviewName(name: string): string;
export function validateReviewSubmission(input: unknown): ReviewValidationResult;
export function shouldCreateReviewInvitation(input: {
  venture: string;
  previousStatus: string | null;
  nextStatus: string | null;
  customerEmail: string | null;
}): boolean;
