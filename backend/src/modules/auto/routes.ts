import { Router } from 'express';
import remediationPolicyRoutes from './routes/remediationPolicyRoutes';
import remediationExecutionRoutes from './routes/remediationExecutionRoutes';
import remediationAuditRoutes from './routes/remediationAuditRoutes';
import autoScaleRoutes from './routes/autoScaleRoutes';

const router = Router();

router.use('/remediation-policies', remediationPolicyRoutes);
router.use('/remediation-executions', remediationExecutionRoutes);
router.use('/remediation-audits', remediationAuditRoutes);
router.use('/auto-scale', autoScaleRoutes);

export default router;
