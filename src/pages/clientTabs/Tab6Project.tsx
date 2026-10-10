import PlaceholderPanel from './PlaceholderPanel';
import type { PanelProps } from './panelContract';

export default function Tab6Project(props: PanelProps) {
  return (
    <PlaceholderPanel
      {...props}
      title="Project"
      description="The project-management workspace for this build, with Launched as the advance action."
      advanceTo="post_sale"
    />
  );
}
