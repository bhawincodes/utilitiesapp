export function getUserProfilePayload(data) {
  return {
    name: data?.name ?? null,
    email: data?.email ?? null,
    phone: data?.phone ?? null,
  };
}
