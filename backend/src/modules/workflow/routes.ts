import { Router } from 'express';
import workflowRoutes from './routes/workflowRoutes';
import taskRoutes from './routes/taskRoutes';
import scheduledTaskRoutes from './routes/scheduledTaskRoutes';

const router = Router();

router.use('/workflows', workflowRoutes);
router.use('/tasks', taskRoutes);
router.use('/scheduled-tasks', scheduledTaskRoutes);

export default router;
