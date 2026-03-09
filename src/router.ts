// SPDX-License-Identifier: Apache-2.0

import type { FastifyInstance } from 'fastify';
import { handleHealthCheck } from './app.controller';

import {
  bootstrapHandler,
  populateHandler,
  promoteHandler,
  fetchLatestTestReportHandler,
  getUnitTestStatusHandler,
  getOrganizationHandler,
} from './services/github.logic.service';

import {
  BootstrapBodySchema,
  BootstrapResponseSchema,
  PopulateBodySchema,
  PopulateResponseSchema,
  PromoteBodySchema,
  PromoteResponseSchema,
  FetchLatestTestReportQuerySchema,
  FetchLatestTestReportResponseSchema,
  UnitTestStatusQuerySchema,
  UnitTestStatusResponseSchema,
  OrganizationResponseSchema,
} from './schemas';

import { SetOptionsBodyAndParams } from './utils/schema-utils';

export const TazamaClaims = {
  EDITOR: 'editor',
  APPROVER: 'approver',
  PUBLISHER: 'publisher',
  EXPORTER: 'exporter',
  MANAGE_ACCOUNT: 'manage-account',
  MANAGE_ACCOUNT_LINKS: 'manage-account-links',
  VIEW_PROFILE: 'view-profile',
  DEFAULT_ROLES_TAZAMA_CMS: 'default-roles-tazama-cms',
  OFFLINE_ACCESS: 'offline_access',
  UMA_AUTHORIZATION: 'uma_authorization',
} as const;

const routePrivilege = {
  bootstrap: TazamaClaims.EDITOR,
  populate: TazamaClaims.EDITOR,
  promote: TazamaClaims.EDITOR,
  report: [TazamaClaims.APPROVER, TazamaClaims.PUBLISHER, TazamaClaims.EDITOR],
  unitTestStatus: [TazamaClaims.APPROVER, TazamaClaims.PUBLISHER, TazamaClaims.EDITOR],
  organization: TazamaClaims.EDITOR,
};

function Routes(fastify: FastifyInstance): void {
  fastify.get('/', handleHealthCheck);
  fastify.get('/health', handleHealthCheck);

  fastify.post('/v1/bootstrap', {
    ...SetOptionsBodyAndParams(
      bootstrapHandler,
      routePrivilege.bootstrap,
      BootstrapBodySchema,
      undefined,
      BootstrapResponseSchema
    ),
  });

  fastify.post('/v1/populate', {
    ...SetOptionsBodyAndParams(
      populateHandler,
      routePrivilege.populate,
      PopulateBodySchema,
      undefined,
      PopulateResponseSchema
    ),
  });

  fastify.post('/v1/promote', {
    ...SetOptionsBodyAndParams(
      promoteHandler,
      routePrivilege.promote,
      PromoteBodySchema,
      undefined,
      PromoteResponseSchema
    ),
  });

  fastify.get('/v1/report', {
    ...SetOptionsBodyAndParams(
      fetchLatestTestReportHandler,
      routePrivilege.report,
      undefined,
      FetchLatestTestReportQuerySchema,
      FetchLatestTestReportResponseSchema
    ),
  });

  fastify.get('/v1/unit-tests/status', {
    ...SetOptionsBodyAndParams(
      getUnitTestStatusHandler,
      routePrivilege.unitTestStatus,
      undefined,
      UnitTestStatusQuerySchema,
      UnitTestStatusResponseSchema
    ),
  });

  fastify.get('/v1/organization', {
    ...SetOptionsBodyAndParams(
      getOrganizationHandler,
      routePrivilege.organization,
      undefined,
      undefined,
      OrganizationResponseSchema
    ),
  });
}

export default Routes;
