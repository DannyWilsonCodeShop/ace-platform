import PlaceholderPanel from './PlaceholderPanel';
import type { PanelProps } from './panelContract';

export default function Tab4Agreement(props: PanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      title="Agreement"
      description="The deal outline — payment dates, amounts, project due date — with contract PDF upload."
      advanceTo="payment_setup"
    />
  );
}
