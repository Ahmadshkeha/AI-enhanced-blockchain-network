class MerkleTree {
  constructor(data) {
    this.data = data;
    this.tree = [];
    this.rootHash = null;
  }

  build() {
    
    const leaves = this.data.map((item) => this.hash(item));

    
    this.buildTree(leaves);

    
    this.rootHash = this.tree[this.tree.length - 1][0];
  }

  buildTree(nodes) {
    this.tree.push(nodes);

    if (nodes.length === 1) {
      return;
    }

    const parentNodes = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const node1 = nodes[i];
      const node2 = i + 1 < nodes.length ? nodes[i + 1] : node1;
      const parent = this.hash(node1 + node2);
      parentNodes.push(parent);
    }

    this.buildTree(parentNodes);
  }

  hash(data) {


    

    // You can use any hash function of your choice here
    // For simplicity, let's assume we're using SHA256
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const updatedData = data.toString(); // Convert data to string
    hash.update(updatedData);
    
    return hash.digest('hex');
  }
}


  module.exports = MerkleTree;