import { Type, type Static } from '@sinclair/typebox';

export type OrganizationResponse = Static<typeof OrganizationResponseSchema>;
export const OrganizationResponseSchema = Type.Object({
  success: Type.Boolean(),
  organization: Type.String(),
});
