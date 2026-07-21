import engineConfig from '../../../config/engine.json';

type AuthoredContentApprovalGate = Readonly<{
  schemaVersion: unknown;
  status: unknown;
  reviewedBy: unknown;
  reviewedAt: unknown;
  evidenceRef: unknown;
}>;

const gate = engineConfig.reportDeliveryContentGates
  .fourFrameAuthoredInterpretation as unknown as AuthoredContentApprovalGate;

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/**
 * Copy is blocked by default. A status string alone cannot enable it: the
 * tracked configuration must also bind reviewer accountability, review date,
 * and an evidence reference. This is an exposure gate, not proof that the
 * review itself was competent; release review must still inspect the evidence.
 */
export const FOUR_FRAME_AUTHORED_COPY_APPROVED =
  gate.schemaVersion === 'namespring.fourframe-authored-copy-approval.v1'
  && gate.status === 'approved'
  && typeof gate.reviewedBy === 'string'
  && gate.reviewedBy.trim().length > 0
  && typeof gate.reviewedAt === 'string'
  && isCalendarDate(gate.reviewedAt)
  && typeof gate.evidenceRef === 'string'
  && /^sha256:[0-9a-f]{64}$/u.test(gate.evidenceRef);
