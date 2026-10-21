import { randomUUID } from 'expo-crypto';
import { SendRequests } from '@/core/send-request';

export const directSendRequests = new SendRequests();
export function requestDirectSend(projectId: string, ids: string[]) {
  return directSendRequests.issue(randomUUID(), projectId, ids);
}
