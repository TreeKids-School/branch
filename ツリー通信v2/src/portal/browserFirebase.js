// The host owns authentication and cloud access. No credential enters the frame.
import { getSession } from './sessionBridge.js';
import { syncReservationDay, manageLineDelivery } from './sharedFirestore.js';
export const firestore = {app: {options: {projectId: 'tree-tsushin-v2-portal'}}, syncReservationDay, manageLineDelivery};
export const auth = {mode: 'staff-portal', get storageMode() { return getSession()?.storageMode || 'shared-firestore'; }};
export default firestore.app;
