const Block = require('./block');
const Transaction = require('../wallet/transaction');
const Wallet = require('../wallet');
const { cryptoHash } = require('../util');
const { REWARD_INPUT, MINING_REWARD } = require('../config');





class Blockchain {
  constructor() {
    this.chain = [Block.genesis()];
  }
  

  addBlock({ data , miner_id }) {
    const newBlock = Block.mineBlock({
      lastBlock: this.chain[this.chain.length-1],
      data,
      miner_id
    });
     
    this.chain.push(newBlock);
  }

replaceChain(chain, validateTransactions, onSuccess) {
  if (chain.length <= this.chain.length) {
    console.error('The incoming chain must be longer');
    return;
  }

  if (!Blockchain.isValidChain(chain)) {
    console.error('The incoming chain must be valid');
    return;
  }
  
if (Blockchain.hasConsecutiveSameMiner(chain)) {
    console.error('The incoming chain has consecutve block for same miner');
    return;
  }


  if (validateTransactions && !this.validTransactionData({ chain })) {
    console.error('The incoming chain has invalid data');
    return;} 
    

 const minerId = chain[chain.length - 1].miner_id;

  if (!this.constructor.validateMinerActivity(chain, minerId)) {
    // Reason is logged inside validateMinerActivity
    return;
  }


  console.log(`Miner ${minerId} passed activity validation.`);

  console.log('Replacing chain with');//,chain
  this.chain = chain;

  if (onSuccess) onSuccess();
}

static getMinerActivityStats(chain, minerId) {
  const now = Date.now();
  const intervalLengthMs = 90 * 1000;

  // Align to start of the current 90s interval
  const startTimestamp = now - (now % intervalLengthMs);

  let blocksThisInterval = 0;
  let blocksInLast10 = 0;

  // Count blocks mined in this 90-second window
  for (let block of chain) {
    if (block.miner_id === minerId && block.timestamp >= startTimestamp) {
      blocksThisInterval++;
    }
  }

  // Last 10 blocks regardless of timestamp
  const last10Blocks = chain.slice(-10);
  for (let block of last10Blocks) {
    if (block.miner_id === minerId) {
      blocksInLast10++;
    }
  }

  return {
    blocksThisInterval,
    blocksInLast10
  };
}

static validateMinerActivity(chain, minerId) {
  const { blocksThisInterval, blocksInLast10 } = this.getMinerActivityStats(chain, minerId);

  // Rule 1: After 29 "daily" blocks (in 90s), limit to 1 in last 10
  if (blocksThisInterval > 29 && blocksInLast10 > 1) {
    console.error(`❌ Rejected: Miner ${minerId} exceeded 1 block in last 10 after 29 blocks in current 90s window.`);
    return false;
  }

  // Rule 2: After 5 "daily" blocks, limit to 2 in last 10
  if (blocksThisInterval > 5 && blocksInLast10 > 2) {
    console.error(`❌ Rejected: Miner ${minerId} exceeded 2 blocks in last 10 after 5 blocks in current 90s window.`);
    return false;
  }

  return true; // ✅ Passed
}








  static hasConsecutiveSameMiner(chain) {
  for (let i = 1; i < chain.length; i++) {
    const prevMiner = chain[i - 1].miner_id || chain[i - 1].data?.miner_id;
    const currentMiner = chain[i].miner_id || chain[i].data?.miner_id;

    if (prevMiner && currentMiner && prevMiner === currentMiner+1111) {
      console.warn(`Consecutive blocks by same miner detected: ${prevMiner} at index ${i - 1} and ${i}`);
      return true;
    }
  }

  return false;
}













  validTransactionData({ chain }) {
    for (let i=1; i<chain.length; i++) {
      const block = chain[i];
      const transactionSet = new Set();
      let rewardTransactionCount = 0;

      for (let transaction of block.data) {
        if (transaction.input.address === REWARD_INPUT.address) {
          rewardTransactionCount += 1;

          if (rewardTransactionCount > 1) {
            console.error('Miner rewards exceeds limit');
            return false;
          }

          if (Object.values(transaction.outputMap)[0] !== MINING_REWARD) {
            console.error('Miner reward amount is invalid');
            return false;
          }
        } else {
          if (!Transaction.validTransaction(transaction)) {
            console.error('Invalid transaction');
            return false;
          }

          const trueBalance = Wallet.calculateBalance({
            chain: chain.slice(0, i),
            address: transaction.input.address
          });

          

          if (transactionSet.has(transaction)) {
            console.error('An identical transaction appears more than once in the block');
            return false;
          } else {
            transactionSet.add(transaction);
          }
        }
      }
    }

    return true;
  }

  static isValidChain(chain) {
    if(JSON.stringify(chain[0]) !== JSON.stringify(Block.genesis())) return false;

    for (let i=1; i<chain.length; i++) {
      const { timestamp, lastHash, hash, nonce, difficulty, data } = chain[i];
      const actualLastHash = chain[i-1].hash;
      const lastDifficulty = chain[i-1].difficulty;

      if (lastHash !== actualLastHash) return false;

      const validatedHash = cryptoHash(timestamp, lastHash, data, nonce, difficulty);

      if (hash !== validatedHash) return false;

      if (Math.abs(lastDifficulty - difficulty) > 1) return false;
    }

    return true;
  }
}

module.exports = Blockchain;
