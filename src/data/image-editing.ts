// Owner tooling is opt-in locally and unavailable in published builds.
export const imageEditingEnabled = import.meta.env.DEV && import.meta.env.VITE_DOJO_IMAGE_EDITOR === 'true';
