import { type Static, Type, type TSchema } from '@sinclair/typebox';

export type UnitTestStatusQuery = Static<typeof UnitTestStatusQuerySchema>;
export const UnitTestStatusQuerySchema: TSchema = Type.Object({
  ruleId: Type.String(),
  branchName: Type.Optional(Type.String()),
});

export type UnitTestStatusResponse = Static<typeof UnitTestStatusResponseSchema>;
export const UnitTestStatusResponseSchema: TSchema = Type.Object({
  success: Type.Boolean(),
  status: Type.String(),
  reportAvailable: Type.Boolean(),
  workflow: Type.Optional(Type.String()),
  branch: Type.Optional(Type.String()),
  github: Type.Optional(
    Type.Object({
      runNumber: Type.Number(),
      runUrl: Type.String(),
      status: Type.String(),
      conclusion: Type.Union([Type.String(), Type.Null()]),
    })
  ),
});
