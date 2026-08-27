import { Router, type IRouter } from "express";
import healthRouter from "../features/health/routes";
import { dashboardAuthRouter } from "../features/auth/routes";
import publicAmRouter from "../features/am/publicRoutes";
import publicPerformanceRouter from "../features/performance/publicRoutes";
import publicFunnelRouter from "../features/funnel/publicRoutes";
import publicActivityRouter from "../features/activity/publicRoutes";
import publicSettingsRouter from "../features/settings/publicRoutes";

// ─── Auth sub-router (mounted at /api/auth with dashboardSessionMw in app.ts) ────
const authSubRouter: IRouter = Router();
authSubRouter.use(dashboardAuthRouter);
export { authSubRouter };

// ─── Public sub-router (mounted at /api/public) ────────────────────────────────
const publicSubRouter: IRouter = Router();
publicSubRouter.use(publicAmRouter);           // /public/am
publicSubRouter.use(publicPerformanceRouter); // /public/performance
publicSubRouter.use(publicFunnelRouter);       // /public/funnel
publicSubRouter.use(publicActivityRouter);     // /public/activity
publicSubRouter.use(publicSettingsRouter);    // /public/settings
export { publicSubRouter };

// ─── Health sub-router (mounted at /api) ──────────────────────────────────────
const healthSubRouter: IRouter = Router();
healthSubRouter.use(healthRouter); // /healthz
export { healthSubRouter };
