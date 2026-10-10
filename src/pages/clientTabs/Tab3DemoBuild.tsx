import PlaceholderPanel from './PlaceholderPanel';
import type { PanelProps } from './panelContract';

export default function Tab3DemoBuild(props: PanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      title="Demo Build"
      description="The cover-page choice board with three demo options and a three-tier quote."
      advanceTo="agreement"
    />
  );
}
