import { Router } from 'express';
import { pricingController } from './pricing.controller';
import {
  createPricingRuleSchema,
  updatePricingRuleSchema,
  pricingRuleParamsSchema,
  listPricingRulesQuerySchema
} from './pricing.validation';
import { validateRequest } from '../../common/middleware/validate.middleware';
import { jwtAuthMiddleware } from '../../common/middleware/auth.middleware';

export const pricingRouter = Router();

// Toàn bộ API Pricing Rules yêu cầu xác thực JWT Bearer
pricingRouter.use(jwtAuthMiddleware);

pricingRouter.get(
  '/',
  validateRequest({ query: listPricingRulesQuerySchema }),
  (req, res, next) => pricingController.list(req, res, next)
);

pricingRouter.get(
  '/:id',
  validateRequest({ params: pricingRuleParamsSchema }),
  (req, res, next) => pricingController.getById(req, res, next)
);

pricingRouter.post(
  '/',
  validateRequest({ body: createPricingRuleSchema }),
  (req, res, next) => pricingController.create(req, res, next)
);

pricingRouter.patch(
  '/:id',
  validateRequest({ params: pricingRuleParamsSchema, body: updatePricingRuleSchema }),
  (req, res, next) => pricingController.update(req, res, next)
);

