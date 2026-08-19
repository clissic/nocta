/** Resuelve la preferencia positiva, con fallback al campo legado. */
export function resolveShowActivityToFollowers(user: {
  showActivityToFollowers?: boolean | null;
  hideActivityFromFollowers?: boolean | null;
}): boolean {
  if (typeof user.showActivityToFollowers === "boolean") {
    return user.showActivityToFollowers;
  }
  if (typeof user.hideActivityFromFollowers === "boolean") {
    return !user.hideActivityFromFollowers;
  }
  return true;
}
