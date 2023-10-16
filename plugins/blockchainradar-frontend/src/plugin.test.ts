import { blockchainPlugin } from './plugin';

describe('blockchain', () => {
  it('should export plugin', () => {
    expect(blockchainPlugin).toBeDefined();
  });
});
