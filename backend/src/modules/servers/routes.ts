import { Router } from 'express';
import serverRoutes from './routes/serverRoutes';
import serverCommandRoutes from './routes/serverCommandRoutes';
import serverGroupRoutes from './routes/serverGroupRoutes';
import serverManagementRoutes from './routes/serverManagementRoutes';
import sshKeyRoutes from './routes/sshKeyRoutes';

const router = Router();

router.use('/servers', serverRoutes);
router.use('/server-commands', serverCommandRoutes);
router.use('/server-groups', serverGroupRoutes);
router.use('/server-management', serverManagementRoutes);
router.use('/ssh-keys', sshKeyRoutes);

export default router;
