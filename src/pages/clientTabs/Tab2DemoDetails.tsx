import PlaceholderPanel from './PlaceholderPanel';
import type { PanelProps } from './panelContract';

export default function Tab2DemoDetails(props: PanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      title="Demo Details"
      description="The call form capturing the client's app details and expected demo delivery date."
      advanceTo="demo_build"
    />
  );
}
