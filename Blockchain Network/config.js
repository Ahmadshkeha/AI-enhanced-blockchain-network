const MINE_RATE = 2000;
const INITIAL_DIFFICULTY = 17;


const GENESIS_DATA = {
  timestamp: 1,
  lastHash: '-----',
  hash: 'hash-one',
  difficulty: INITIAL_DIFFICULTY,
  nonce: 0,
   data: [
    { input: 'foo1', outputMap: 'foo1', id: 1001 },
    { input: 'foo2', outputMap: 'foo2', id: 1002 },
    { input: 'foo3', outputMap: 'foo3', id: 1003 }
  ],
};

const STARTING_BALANCE = 1000;

const REWARD_INPUT = { address: '*authorized-reward*' };

const MINING_REWARD = 50;

module.exports = {
  GENESIS_DATA,
  MINE_RATE,
  STARTING_BALANCE,
  REWARD_INPUT,
  MINING_REWARD
};
