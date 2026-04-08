import { checkAndGenerateMissingRecaps } from './src/recap';
checkAndGenerateMissingRecaps().then(() => console.log('Done')).catch(console.error);
