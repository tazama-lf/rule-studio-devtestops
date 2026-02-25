import { Type, type Static } from '@sinclair/typebox';

export type BootstrapBody = Static<typeof BootstrapBodySchema>;
export const BootstrapBodySchema = Type.Object({
  ruleId: Type.String(),
  ruleVersion: Type.String(),
});

export type BootstrapResponse = Static<typeof BootstrapResponseSchema>;
export const BootstrapResponseSchema = Type.Object({
  success: Type.Boolean(),
  repoUrl: Type.Optional(Type.String()),
  message: Type.String(),
});
