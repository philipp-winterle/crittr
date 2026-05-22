import log from '@dynamicabot/signales';
import { Crittr } from './lib/classes/Crittr.class.js';
import type { CrittrOptions, CrittrResult } from './lib/types.js';

/**
 * Extract the critical CSS for one or more URLs.
 *
 * @param options - The {@link CrittrOptions} configuration object
 * @returns Promise resolving to `{ critical, rest }` — both may be `null` on error
 */
const crittr = async (options: CrittrOptions): Promise<CrittrResult> => {
    log.time('Crittr Run');

    const instance = new Crittr(options);
    const resultObj: CrittrResult = await instance.run();

    log.timeEnd('Crittr Run');
    return resultObj;
};

export default crittr;
