// Core API Types
export interface VoltageApiConfig {
  baseUrl?: string;
  apiKey?: string;
  bearerToken?: string;
  timeout?: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

// Currency and Amount Types
export type Currency = 'btc' | 'usd';

export interface BtcAmount {
  amount: number;
  currency: 'btc';
}

export interface UsdAmount {
  amount: number;
  currency: 'usd';
}

export type Amount = BtcAmount | UsdAmount;

export interface SignedAmount {
  amount: number;
  currency: Currency;
  negative: boolean;
}

// Network Types
export type Network = 'mainnet' | 'testnet' | 'signet' | 'mutinynet';
export type SupportedNetwork = 'mainnet' | 'testnet3' | 'mutinynet';

// Balance Types
export interface Balance {
  id?: string;
  wallet_id: string;
  effective_time: string;
  available: SignedAmount;
  total: SignedAmount;
  network: Network;
  currency: Currency;
}

// Hold Types
export interface Hold {
  id?: string;
  amount: SignedAmount;
  effective_time: string;
}

// Wallet Types
export interface Wallet {
  id?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deletion_failed_at?: string | null;
  name: string;
  organization_id?: string;
  environment_id?: string;
  limit?: number | null;
  line_of_credit_id?: string | null;
  network: Network;
  metadata?: Record<string, string> | null;
  balances: Balance[];
  holds: Hold[];
  error?: WalletEventError | null;
}

export interface NewWalletRequest {
  id?: string;
  environment_id?: string;
  line_of_credit_id?: string;
  name: string;
  network: SupportedNetwork;
  limit: number;
  metadata?: Record<string, string> | null;
}

// Wallet Error Types
export type WalletEventError =
  | { type: 'InsufficientFunds' }
  | { type: 'HoldNotFound' }
  | { type: 'InsufficientLimit'; detail: string };

// Payment Types
export type PaymentKind = 'bolt11' | 'onchain' | 'bip21';
export type PaymentDirection = 'send' | 'receive';
export type SendStatus = 'sending' | 'failed' | 'completed';
export type ReceiveStatus = 'generating' | 'receiving' | 'expired' | 'failed' | 'completed';

// On-chain Receipt Types
export interface OnChainPaymentReceipt {
  required_confirmations_num: number;
  tx_id?: string;
  ledger_id?: string | null;
  height_mined_at?: number | null;
  amount_sats: number;
}

// Payment Data Types
export interface BoltPaymentData {
  payment_request?: string | null;
  amount_msats: number;
  memo?: string | null;
}

export interface OnChainPaymentData {
  address?: string | null;
  amount_sats: number;
  label?: string | null;
  receipts: OnChainPaymentReceipt[];
}

export interface Bip21PaymentData {
  payment_request?: string | null;
  address?: string | null;
  amount_msats: number;
  description?: string | null;
  receipts: OnChainPaymentReceipt[];
}

// Send Payment Data Types
export interface SendBoltPaymentData {
  payment_request?: string | null;
  amount_msats: number;
  memo?: string | null;
  max_fee_msats: number;
  fee_msats?: number | null;
}

export interface SendOnChainPaymentData {
  address?: string | null;
  amount_sats: number;
  max_fee_sats: number;
  fee_sats?: number | null;
  label?: string | null;
  outflows: OnChainPaymentReceipt[];
}

export interface SendBip21PaymentData {
  payment_request?: string | null;
  address?: string | null;
  amount_msats: number;
  max_fee_msats: number;
  fee_msats?: number | null;
  description?: string | null;
  outflows: OnChainPaymentReceipt[];
}

// Payment Type Unions
export type PaymentReceiveType =
  | { type: 'bolt11'; data: BoltPaymentData }
  | { type: 'onchain'; data: OnChainPaymentData }
  | { type: 'bip21'; data: Bip21PaymentData };

export type PaymentSendType =
  | { type: 'bolt11'; data: SendBoltPaymentData }
  | { type: 'onchain'; data: SendOnChainPaymentData }
  | { type: 'bip21'; data: SendBip21PaymentData };

// Base Payment Interface
export interface BasePayment {
  id?: string;
  wallet_id: string;
  organization_id?: string;
  environment_id?: string;
  created_at: string;
  updated_at: string;
  currency: Currency;
}

// Send and Receive Payment Types
export type SendPayment = BasePayment &
  PaymentSendType & {
    direction: 'send';
    status: SendStatus;
    error?: SendError | null;
  };

export type ReceivePayment = BasePayment &
  PaymentReceiveType & {
    direction: 'receive';
    status: ReceiveStatus;
    error?: ReceiveError | null;
    frozen?: PaymentFrozen[];
  };

export type Payment = SendPayment | ReceivePayment;

// Error Types
export type SendError =
  | { type: 'rejected'; detail: string }
  | { type: 'hold_failed'; detail: string }
  | { type: 'send_failed'; detail: string };

export type ReceiveError = { type: 'receive_failed'; detail: string } | { type: 'expired' };

// Frozen Payment Types
export interface OnChainPaymentFrozen {
  tx_id?: string;
  address: string;
  amount_sats: number;
  reason: Reasons;
}

export type PaymentFrozen = { type: 'onchain'; data: OnChainPaymentFrozen };

export type Reasons = 'ofac_non_compliant_address' | { other: string };

// Pagination Types
export interface PaginatedResponse<T> {
  items: T[];
  offset: number;
  limit: number;
  total: number;
}

export type Payments = PaginatedResponse<Payment>;

// Request Types
export interface ReceivePaymentRequest {
  id?: string;
  wallet_id: string;
  currency: Currency;
  amount_msats?: number | null;
  payment_kind: PaymentKind;
  description?: string | null;
}

// Send Payment Request Types
export interface SendBolt11PaymentRequest {
  payment_request: string;
  amount_msats?: number | null;
  max_fee_msats?: number | null;
}

export interface SendOnChainPaymentRequest {
  address: string;
  amount_sats: number;
  max_fee_sats?: number | null;
  description?: string | null;
}

export interface SendBip21PaymentRequest {
  address: string;
  payment_request?: string | null;
  amount_msats?: number | null;
  max_fee_msats?: number | null;
  description?: string | null;
}

export type SendPaymentTypeRequest =
  | { type: 'bolt11'; data: SendBolt11PaymentRequest }
  | { type: 'onchain'; data: SendOnChainPaymentRequest }
  | { type: 'bip21'; data: SendBip21PaymentRequest };

export interface SendPaymentRequest {
  id?: string;
  wallet_id: string;
  currency: Currency;
}

export type SendPaymentRequestData = SendPaymentRequest & SendPaymentTypeRequest;

// Payment Creation Parameters
export interface CreatePaymentRequestParams {
  organization_id?: string;
  environment_id?: string;
  payment: ReceivePaymentRequest;
}

export interface SendPaymentParams {
  organization_id?: string;
  environment_id?: string;
  payment: SendPaymentRequestData;
}

export interface GetPaymentParams {
  organization_id?: string;
  environment_id?: string;
  payment_id?: string;
}

// Polling Configuration
export interface PollingConfig {
  maxAttempts?: number;
  intervalMs?: number;
  timeoutMs?: number;
}

// Default polling configuration
export const DEFAULT_POLLING_CONFIG: Required<PollingConfig> = {
  maxAttempts: 30,
  intervalMs: 1000,
  timeoutMs: 30000,
};

// Request Parameters
export interface GetWalletsParams {
  organization_id?: string;
}

export interface GetWalletParams {
  organization_id?: string;
  wallet_id: string;
}

export interface CreateWalletParams {
  organization_id?: string;
  wallet: NewWalletRequest;
}

export interface DeleteWalletParams {
  organization_id?: string;
  wallet_id: string;
}

// Sort and Filter Types
export type SortOrder = 'ASC' | 'DESC';
export type SortKey = 'created_at' | 'updated_at';
export type LedgerSortKey = 'effective_time' | 'message_time' | 'time_and_effective_time';

// Payment Status Types
export type PaymentStatus = SendStatus | ReceiveStatus;

// Payment List Parameters
export interface GetPaymentsParams {
  organization_id?: string;
  environment_id?: string;
  offset?: number;
  limit?: number;
  wallet_id?: string;
  statuses?: PaymentStatus[];
  sort_key?: SortKey;
  sort_order?: SortOrder;
  kind?: PaymentKind;
  direction?: PaymentDirection;
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
}

// Ledger Types
export interface LedgerEvent {
  type: 'credited' | 'captured' | 'held' | 'released';
  hold_id?: string;
  credit_id?: string;
  payment_id: string;
  amount_msats?: number;
  currency: Currency;
  effective_time: string;
}

export interface Ledger {
  items: LedgerEvent[];
  offset: number;
  limit: number;
  total: number;
}

// Wallet Ledger Parameters
export interface GetWalletLedgerParams {
  organization_id?: string;
  wallet_id: string;
  offset?: number;
  limit?: number;
  payment_id?: string;
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  sort_key?: LedgerSortKey;
  sort_order?: SortOrder;
}

// Payment History Types
export interface EventHistory {
  event_type: string;
  error?: string | null;
  time: string; // ISO date string
  position: number;
}

export interface PaymentHistory {
  events: EventHistory[];
}

// Payment History Parameters
export interface GetPaymentHistoryParams {
  organization_id?: string;
  environment_id?: string;
  payment_id: string;
}

// Lines of Credit Types
export type CollateralStatus = { secured: SecuredStatus } | { verified: VerifiedStatus };

export type SecuredStatus = 'pending_deposit' | 'partially_secured' | 'secured';
export type VerifiedStatus = 'pending_verification' | 'verified';

export interface LineOfCredit {
  id: string;
  organization_id: string;
  network: Network;
  environment_id: string;
  limit: number;
  allocated_limit: number;
  currency: Currency;
  status?: CollateralStatus | null;
  disabled_at?: string | null;
}

// Lines of Credit Parameters
export interface GetLineOfCreditParams {
  organization_id?: string;
  line_id: string;
}

export interface GetLinesOfCreditParams {
  organization_id?: string;
}
