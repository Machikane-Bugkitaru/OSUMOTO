import express from 'express';
import { createApplication } from './bootstrap';

// Keep Express application creation here for Vercel entrypoint discovery.
const { app, port } = createApplication(express());
export { app };
if (require.main === module) {
  app.listen(port);
  console.log(`Server running at ${port}`);
}
export default app;
