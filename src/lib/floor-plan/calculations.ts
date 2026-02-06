import type { AgingInfo, CurtailmentInfo, AgingStatus } from '@/types/floor-plan';

/**
 * Calculate daily interest for a floor plan
 */
export function calculateDailyInterest(
  currentBalance: number,
  annualRate: number
): number {
  const dailyRate = annualRate / 100 / 365;
  return Math.round(currentBalance * dailyRate * 100) / 100;
}

/**
 * Calculate accrued interest for a period
 */
export function calculateAccruedInterest(
  currentBalance: number,
  annualRate: number,
  days: number,
  interestType: 'simple' | 'compound' = 'simple'
): number {
  const dailyRate = annualRate / 100 / 365;

  if (interestType === 'simple') {
    return Math.round(currentBalance * dailyRate * days * 100) / 100;
  }

  // Compound interest (daily compounding)
  const compoundedAmount = currentBalance * Math.pow(1 + dailyRate, days);
  return Math.round((compoundedAmount - currentBalance) * 100) / 100;
}

/**
 * Calculate curtailment amount due
 */
export function calculateCurtailmentAmount(
  floorAmount: number,
  curtailmentPercent: number
): number {
  return Math.round(floorAmount * (curtailmentPercent / 100) * 100) / 100;
}

/**
 * Calculate days floored
 */
export function calculateDaysFloored(floorDate: string | Date): number {
  const start = new Date(floorDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Calculate days until a date
 */
export function calculateDaysUntil(targetDate: string | Date): number {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate next curtailment date
 */
export function calculateNextCurtailmentDate(
  floorDate: string | Date,
  curtailmentDays: number,
  curtailmentsPaid: number,
  subsequentDays: number
): Date {
  const start = new Date(floorDate);

  if (curtailmentsPaid === 0) {
    start.setDate(start.getDate() + curtailmentDays);
    return start;
  }

  // First curtailment date + (subsequent days * number of additional curtailments)
  start.setDate(start.getDate() + curtailmentDays + (subsequentDays * curtailmentsPaid));
  return start;
}

/**
 * Get aging status for display
 */
export function getAgingStatus(daysFloored: number): AgingInfo {
  let status: AgingStatus;
  let color: string;
  let label: string;

  if (daysFloored <= 60) {
    status = 'healthy';
    color = 'text-green-600 dark:text-green-500';
    label = 'Healthy';
  } else if (daysFloored <= 90) {
    status = 'warning';
    color = 'text-yellow-600 dark:text-yellow-500';
    label = 'Watch';
  } else {
    status = 'critical';
    color = 'text-red-600 dark:text-red-500';
    label = 'Aging';
  }

  return { status, daysFloored, color, label };
}

/**
 * Get curtailment status for display
 */
export function getCurtailmentStatus(
  nextCurtailmentDate: string | Date | null,
  isPastDue: boolean
): CurtailmentInfo {
  if (!nextCurtailmentDate) {
    return {
      daysUntil: 0,
      isPastDue: false,
      status: 'ok',
      label: 'No curtailment',
      color: 'text-muted-foreground',
    };
  }

  const daysUntil = calculateDaysUntil(nextCurtailmentDate);

  if (isPastDue || daysUntil < 0) {
    return {
      daysUntil,
      isPastDue: true,
      status: 'past_due',
      label: `${Math.abs(daysUntil)}d overdue`,
      color: 'text-red-600 dark:text-red-500',
    };
  }

  if (daysUntil === 0) {
    return {
      daysUntil: 0,
      isPastDue: false,
      status: 'due',
      label: 'Due today',
      color: 'text-red-600 dark:text-red-500',
    };
  }

  if (daysUntil <= 7) {
    return {
      daysUntil,
      isPastDue: false,
      status: 'upcoming',
      label: `${daysUntil}d`,
      color: 'text-yellow-600 dark:text-yellow-500',
    };
  }

  return {
    daysUntil,
    isPastDue: false,
    status: 'ok',
    label: `${daysUntil}d`,
    color: 'text-muted-foreground',
  };
}

/**
 * Estimate monthly interest for a set of floor plans
 */
export function estimateMonthlyInterest(
  floorPlans: Array<{ current_balance: number; interest_rate: number }>
): number {
  return floorPlans.reduce((total, fp) => {
    const monthlyRate = fp.interest_rate / 100 / 12;
    return total + (fp.current_balance * monthlyRate);
  }, 0);
}

/**
 * Calculate credit utilization percentage
 */
export function calculateCreditUtilization(
  creditLimit: number,
  availableCredit: number
): number {
  if (creditLimit <= 0) return 0;
  const used = creditLimit - availableCredit;
  return Math.round((used / creditLimit) * 1000) / 10; // Round to 1 decimal
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format currency with cents for display
 */
export function formatCurrencyWithCents(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate remaining balance after payment
 */
export function calculateBalanceAfterPayment(
  currentBalance: number,
  paymentAmount: number
): number {
  return Math.max(0, Math.round((currentBalance - paymentAmount) * 100) / 100);
}

/**
 * Calculate total payoff amount (balance + unpaid interest)
 */
export function calculatePayoffAmount(
  currentBalance: number,
  unpaidInterest: number,
  payoffFee: number = 0
): number {
  return Math.round((currentBalance + unpaidInterest + payoffFee) * 100) / 100;
}
