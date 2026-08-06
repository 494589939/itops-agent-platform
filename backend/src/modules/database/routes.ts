import { Router } from 'express';
import databaseRoutes from './routes/databaseRoutes';
import dbConnectionsRoutes from './routes/dbConnectionsRoutes';

const router = Router();

router.use('/database', databaseRoutes);
router.use('/db-connections', dbConnectionsRoutes);

export default router;
