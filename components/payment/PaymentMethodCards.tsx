import { Button, Card } from "@/components/ui";

interface PaymentMethodCardsProps {
  method: "upi" | "cash";
  upiProvider: "gpay" | "phonepe" | "paytm";
  cashOtp: string;
  onMethodChange: (method: "upi" | "cash") => void;
  onUpiProviderChange: (provider: "gpay" | "phonepe" | "paytm") => void;
  onCashOtpChange: (otp: string) => void;
  onPay: () => void;
  isLoading?: boolean;
}

export function PaymentMethodCards({
  method,
  upiProvider,
  cashOtp,
  onMethodChange,
  onUpiProviderChange,
  onCashOtpChange,
  onPay,
  isLoading,
}: PaymentMethodCardsProps) {
  return (
    <Card title="Payment Method" subtitle="Use UPI for instant confirmation or cash OTP mode.">
      <div className="payment-method-grid">
        <div className="payment-method-toggle">
          <Button variant={method === "upi" ? "primary" : "secondary"} onClick={() => onMethodChange("upi")}>
            UPI
          </Button>
          <Button variant={method === "cash" ? "primary" : "secondary"} onClick={() => onMethodChange("cash")}>
            Cash
          </Button>
        </div>

        {method === "upi" ? (
          <label className="payment-field">
            <span className="card-subtitle">UPI app</span>
            <select
              className="select"
              value={upiProvider}
              onChange={(event) =>
                onUpiProviderChange(event.target.value as "gpay" | "phonepe" | "paytm")
              }
            >
              <option value="gpay">Google Pay</option>
              <option value="phonepe">PhonePe</option>
              <option value="paytm">Paytm</option>
            </select>
          </label>
        ) : (
          <label className="payment-field">
            <span className="card-subtitle">Cash OTP (demo)</span>
            <input
              className="input"
              placeholder="Enter 4-digit OTP"
              maxLength={4}
              value={cashOtp}
              onChange={(event) => onCashOtpChange(event.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}

        <Button onClick={onPay} isLoading={isLoading} className="payment-submit-btn">
          Complete Payment
        </Button>
      </div>
    </Card>
  );
}
