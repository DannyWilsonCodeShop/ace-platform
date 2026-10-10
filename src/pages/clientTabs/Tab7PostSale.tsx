import PlaceholderPanel from './PlaceholderPanel';
import type { PanelProps } from './panelContract';

export default function Tab7PostSale(props: PanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      title="Post-Sale"
      description="The post-sale log, notes, and drip-campaign selection for this client."
      advanceTo="monthly_service"
    />
  );
}
