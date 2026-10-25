import { createApplication } from './bootstrap';

const { app, port } = createApplication();
export { app };
if (require.main === module) {
  app.listen(port);
  console.log(`Server running at ${port}`);
}
export default app;
