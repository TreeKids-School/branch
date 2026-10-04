// This facade deliberately has no Firebase SDK, API key, token or remote URL.
export const firestore = {app: {options: {projectId: 'tree-tsushin-v2-browser'}}};
export const auth = {mode: 'staff-portal'};
export default firestore.app;
