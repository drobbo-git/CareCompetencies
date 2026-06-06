import 'dotenv/config';
import { createApp } from './app';

const port = parseInt(process.env.PORT ?? '3001', 10);
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
