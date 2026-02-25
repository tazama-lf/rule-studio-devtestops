import { Type, type Static } from '@sinclair/typebox';

export type PromoteBody = Static<typeof PromoteBodySchema>;
export const PromoteBodySchema = Type.Object({
  ruleId: Type.String(),
  branchName: Type.String(),
});

export type PromoteResponse = Static<typeof PromoteResponseSchema>;
export const PromoteResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});
