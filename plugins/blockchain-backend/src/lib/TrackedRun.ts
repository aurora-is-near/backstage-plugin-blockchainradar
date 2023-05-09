import { Logger } from 'winston';
import retry from 'async-retry';

interface TrackedObject {
  logger: Logger;
}

export class TrackedRun {
  public trackedObject: any;
  public action: string;

  public duration = 0;
  public success = true;
  public error: string = '';
  public logger: Logger;
  public tags: Record<string, string> = {};

  constructor(
    trackedObject: TrackedObject,
    action: string,
    extraLoggerInfo = {},
  ) {
    this.action = action;
    const loggerArgs: any = {
      class: trackedObject.constructor.name,
      action,
      ...extraLoggerInfo,
    };
    if ((trackedObject as any).address)
      loggerArgs.addr = (trackedObject as any).address;
    this.logger = trackedObject.logger.child(loggerArgs);
    this.trackedObject = trackedObject;
  }

  public async retry(
    retries: number,
    action: string,
    callback: (
      logger: Logger,
      callbackBail: (e: Error) => void,
    ) => Promise<void>,
  ): Promise<void> {
    await retry(
      async (bail, attempt) => {
        await this.benchmark(`attempt #${attempt} to ${action}`, async () => {
          await callback(this.logger, bail);
        });
      },
      {
        retries,
      },
    );
  }

  public async executeWithRetry(
    retries: number,
    callback: (
      logger: Logger,
      callbackBail: (e: Error) => void,
    ) => Promise<void>,
  ) {
    await this.execute(async () => {
      await this.retry(retries, this.action, callback);
    });
  }

  public async execute(callback: (logger: Logger) => Promise<void>) {
    try {
      this.duration = await this.benchmark(this.action, callback);
    } catch (e) {
      this.success = false;
      this.duration = -1;
      this.error = (e as Error).message;
      this.logger.error(this.error);
      this.logger.verbose((e as Error).stack);
      throw e;
    }
  }

  public async benchmark(
    action: string,
    callback: (logger: Logger) => Promise<void>,
  ): Promise<number> {
    const startDate = new Date();

    this.logger.verbose(`${action} start`);

    try {
      await callback(this.logger);

      this.logger.verbose(`${action} end ${this.bm(startDate)}`);
    } catch (e) {
      this.logger.warn(
        `${action} error ${this.bm(startDate)}: ${(e as Error).message}`,
      );
      this.logger.debug((e as Error).stack);
      throw e;
    }
    return this.durationCalc(startDate);
  }

  public durationCalc(start: Date) {
    return (new Date().getTime() - start.getTime()) / 1000;
  }

  public bm(start: Date) {
    return `(${this.durationCalc(start).toFixed(1)}s)`;
  }
}
