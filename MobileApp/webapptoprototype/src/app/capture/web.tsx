import { useLocalSearchParams } from 'expo-router';

import { WebWorkspace } from '@/features/capture/web-workspace';

export default function WebCaptureScreen() {
  const { url, projectId } = useLocalSearchParams<{ url: string; projectId: string }>();
  return <WebWorkspace url={url} projectId={projectId} />;
}
