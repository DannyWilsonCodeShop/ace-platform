import PlaceholderPanel from './PlaceholderPanel';
import type { PanelProps } from './panelContract';

export default function Tab1QuoteRequested(props: PanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      title="Quote Requested"
      description="The incoming request, AI recommendation, and contact-attempt log for this client."
      advanceTo="demo_details"
    />
  );
}
