/** Profil resmi yolunu, resmi sunan rota işleyiciye (Görev 11) çevirir. Yol yoksa null. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `/api/avatar/${encodeURIComponent(path)}`;
}
