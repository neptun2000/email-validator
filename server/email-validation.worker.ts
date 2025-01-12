import { parentPort, workerData } from 'worker_threads';
import { validateEmailForWorker } from './email-validation-utils';

async function validateEmailInWorker() {
  const { email, clientIp } = workerData;
  try {
    const result = await validateEmailForWorker(email, clientIp);
    parentPort?.postMessage({ success: true, result });
  } catch (error) {
    parentPort?.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

validateEmailInWorker().catch(error => {
  parentPort?.postMessage({
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  });
});