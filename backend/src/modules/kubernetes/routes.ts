import { Router } from 'express';
import kubernetesRoutes from './routes/kubernetesRoutes';

const router = Router();

router.use('/kubernetes', kubernetesRoutes);

export default router;
