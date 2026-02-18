// SPDX-License-Identifier: Apache-2.0

import type { FastifyRequest } from 'fastify';

export interface ITenantRequest extends FastifyRequest {
  tenantId: string;
  tenantToken?: string;
  organizationName?: string;
}
export interface JwtPayloadWithClaims {
  tenantId?: string;
  claims?: string[];
  [key: string]: unknown;
}
export interface JWTPayload {
  tenantId?: string;
}
export interface TenantCredentials {
  token: string;
  organizationName: string;
}
