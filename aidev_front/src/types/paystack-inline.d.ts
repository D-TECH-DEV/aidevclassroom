declare module "@paystack/inline-js" {
  export interface PaystackResumeOptions {
    onSuccess?: (transaction: { reference?: string }) => void;
    onCancel?: () => void;
    onError?: (error: { message?: string }) => void;
  }

  export default class PaystackPop {
    resumeTransaction(accessCode: string, options?: PaystackResumeOptions): void;
  }
}
