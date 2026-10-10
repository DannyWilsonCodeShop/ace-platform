import PlaceholderPanel from './PlaceholderPanel';
import type { PanelProps } from './panelContract';

export default function Tab5PaymentSetup(props: PanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      title="Payment Setup"
      description="The custom Stripe payment-setup flow covering every deal type, plus payment tracking."
      advanceTo="project"
    />
  );
}
