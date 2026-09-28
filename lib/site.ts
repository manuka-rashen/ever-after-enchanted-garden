export const assetUrl = (name: string) => `${import.meta.env.BASE_URL}${name}`;
export const invitationUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;
