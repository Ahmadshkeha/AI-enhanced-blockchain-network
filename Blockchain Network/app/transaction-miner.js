const Blockchain = require('../blockchain'); // path to your Blockchain class
const Transaction = require('../wallet/transaction');

class TransactionMiner {
  constructor({ blockchain, transactionPool, wallet, pubsub }) {
    this.blockchain = blockchain;
    this.transactionPool = transactionPool;
    this.wallet = wallet;
    this.pubsub = pubsub;
  }

 mineTransactions(miner_id) {
  const validTransactions = this.transactionPool.validTransactions();

  validTransactions.push(
    Transaction.rewardTransaction({ minerWallet: this.wallet })
  );

  this.blockchain.addBlock({ data: validTransactions, miner_id });

  if (
    !Blockchain.isValidChain(this.blockchain.chain) ||
   Blockchain.hasConsecutiveSameMiner(this.blockchain.chain)|| //AI rules
    !Blockchain.validateMinerActivity(this.blockchain.chain, miner_id) //AI rules
  ) {
    console.error('❌ Invalid chain after mining. Reverting...');
    this.blockchain.chain.pop();
    return false; // <== return failure
  }

  this.pubsub.broadcastChain();
  this.transactionPool.clear();
  return true; // <== return success
}

}

module.exports = TransactionMiner;
