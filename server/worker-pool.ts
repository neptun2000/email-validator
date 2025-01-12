import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{
    task: any,
    resolve: (value: any) => void,
    reject: (reason?: any) => void
  }> = [];
  private readonly maxWorkers: number;
  private activeWorkers: number = 0;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = maxWorkers;
  }

  async execute(task: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0 || this.activeWorkers >= this.maxWorkers) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift()!;
    this.activeWorkers++;

    // Use tsx to run TypeScript files
    const worker = new Worker(`
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
      const { tsx } = require('tsx');
      tsx.runFile('${path.join(__dirname, 'email-validation.worker.ts')}');
    `, {
      eval: true,
      workerData: task
    });

    worker.on('message', (result) => {
      if (result.success) {
        resolve(result.result);
      } else {
        reject(new Error(result.error));
      }
      this.cleanupWorker(worker);
    });

    worker.on('error', (error) => {
      reject(error);
      this.cleanupWorker(worker);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
      this.cleanupWorker(worker);
    });

    this.workers.push(worker);
  }

  private cleanupWorker(worker: Worker) {
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
    }
    this.activeWorkers--;
    this.processQueue();
  }

  terminate() {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.queue = [];
    this.activeWorkers = 0;
  }
}