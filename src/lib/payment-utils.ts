import { PartyCategory, PartyBalanceResponseDTO, PaymentDirection } from "@/types/dto";

export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirection, string> = {
  payin: "Pay In",
  payout: "Payout",
};

export const PAYMENT_DIRECTION_DESCRIPTIONS: Record<PaymentDirection, string> = {
  payin: "Money received from the party",
  payout: "Money paid to the party",
};

export function getAllowedPaymentDirections(
  category?: PartyCategory,
  balanceDirection?: PartyBalanceResponseDTO["direction"]
): PaymentDirection[] {
  void category;
  void balanceDirection;
  // Always allow both directions — category/balance are hints, not locks.
  // A supplier may owe you (to-receive) after a sale; a customer may need a refund.
  return ["payin", "payout"];
}

export function getDefaultPaymentDirection(
  category?: PartyCategory,
  balanceDirection?: PartyBalanceResponseDTO["direction"]
): PaymentDirection {
  // Default: customer → payin, supplier → payout, balance hint otherwise
  if (category === "customer") return "payin";
  if (category === "supplier") return "payout";
  if (balanceDirection === "to-receive") return "payin";
  if (balanceDirection === "to-pay") return "payout";
  return "payin";
}

export function getSuggestedAmountForDirection(
  balance?: PartyBalanceResponseDTO,
  direction?: PaymentDirection
): number | null {
  if (!balance || !direction) return null;
  if (direction === "payin" && balance.direction === "to-receive") {
    return Math.abs(balance.outstandingBalance);
  }
  if (direction === "payout" && balance.direction === "to-pay") {
    return Math.abs(balance.outstandingBalance);
  }
  return null;
}