import PlaceholderPanel from './PlaceholderPanel';
import type { PanelProps } from './panelContract';

export default function Tab8MonthlyService(props: PanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      title="Monthly Service"
      description="The fixed monthly checklist and service flow. This is the final stage."
      advanceTo={null}
    />
  );
}
