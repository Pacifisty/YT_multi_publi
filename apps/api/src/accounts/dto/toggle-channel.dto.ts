export interface ToggleChannelDto {
  isActive: boolean;
}

export function isValidToggleChannelDto(body: unknown): body is ToggleChannelDto {
  if (typeof body !== 'object' || body === null) return false;
  const dto = body as Record<string, unknown>;
  return typeof dto.isActive === 'boolean';
}
