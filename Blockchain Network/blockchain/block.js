const hexToBinary = require('hex-to-binary');
const { GENESIS_DATA, MINE_RATE } = require('../config');
const { cryptoHash } = require('../util');
const MerkleTree = require('../util/merkleTree');
const { json } = require('body-parser');

class Block {
  constructor({ timestamp, lastHash, hash, data, nonce, difficulty , miner_id}) {
    this.timestamp = timestamp;
    this.lastHash = lastHash;
    this.hash = hash;
    this.data = data;
    this.nonce = nonce;
    this.difficulty = difficulty;
    this.miner_id = miner_id;
    

      
   const transactionStrings = [];
      for (const transaction of data) {
          const transactionString = transaction.id + transaction.outputMap + transaction.input;
        transactionStrings.push(transactionString);
      }      
      
      
    const merkleTree = new MerkleTree(transactionStrings);
    merkleTree.build();
    this.merkleRoot = merkleTree.rootHash; 
  }

  static genesis() {
    return new this(GENESIS_DATA);
  }

  static mineBlock({ lastBlock, data, miner_id, cancelCheck }) {
  const lastHash = lastBlock.hash;
  let hash, timestamp;
  let { difficulty } = lastBlock;
  let nonce = 0;

  do {
    if (cancelCheck && cancelCheck()) {
      console.log("⛔ Mining cancelled");
      return null; // Indicate mining was aborted
    }

    nonce++;
    timestamp = Date.now();
    difficulty = Block.adjustDifficulty({ originalBlock: lastBlock, timestamp });
    hash = cryptoHash(timestamp, lastHash, data, nonce, difficulty);
  } while (hexToBinary(hash).substring(0, difficulty) !== '0'.repeat(difficulty));

  return new this({ timestamp, lastHash, data, difficulty, nonce, hash, miner_id });
}


  static adjustDifficulty({ originalBlock, timestamp }) {
    const { difficulty } = originalBlock;

    if (difficulty < 1) return 1;

    if ((timestamp - originalBlock.timestamp) > MINE_RATE) return difficulty - 1;

    return difficulty + 1;
  }
}

module.exports = Block;
