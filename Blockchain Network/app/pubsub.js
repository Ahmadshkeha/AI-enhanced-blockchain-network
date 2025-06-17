const { connect, StringCodec } = require('nats');
const { v4: uuidv4 } = require('uuid');

const CHANNELS = {
    TEST: "TEST",
    BLOCKCHAIN: "BLOCKCHAIN",
    TRANSACTION: "TRANSACTION",
    STATUS: "STATUS"
};

class PubSub {
    constructor({ blockchain, transactionPool, natsUrl = 'nats://localhost:4222' }) {
        this.blockchain = blockchain;
        this.transactionPool = transactionPool;
        this.natsUrl = natsUrl;
        this.nodeId = uuidv4();
        this.sc = StringCodec();

        this.nc = null;
        this.isConnected = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        this.reconnectDelay = 5000;
        this.subscriptions = new Map();
        this.reconnectTimeout = null;

        this._initialize();
    }

    async _initialize() {
        try {
            console.log('Connecting to NATS server...');

            await this._safeClose();

            this.nc = await connect({
                servers: this.natsUrl,
                reconnect: true,
                maxReconnectAttempts: this.maxConnectionAttempts,
                reconnectTimeWait: this.reconnectDelay
            });

            this._setupEventListeners();
            await this.subscribeToChannels();

            console.log('NATS PubSub initialized successfully');
            this.isConnected = true;
            this.connectionAttempts = 0;
        } catch (error) {
            console.error('NATS connection failed:', error);
            this._handleConnectionFailure();
        }
    }

    _setupEventListeners() {
        this.nc.closed()
            .then(() => {
                console.log('NATS connection closed');
                this.isConnected = false;
                this._handleConnectionFailure();
            })
            .catch((err) => {
                console.error('NATS closed with error:', err);
                this.isConnected = false;
                this._handleConnectionFailure();
            });

        this.nc.addEventListener?.('reconnect', () => {
            console.log('Reconnected to NATS server');
            this.isConnected = true;
        });

        this.nc.addEventListener?.('disconnect', () => {
            console.log('Disconnected from NATS server');
            this.isConnected = false;
        });

        this.nc.addEventListener?.('error', (err) => {
            console.error('NATS connection error:', err);
            this.isConnected = false;
        });
    }

    _handleConnectionFailure() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        this.connectionAttempts++;
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error(`Max connection attempts (${this.maxConnectionAttempts}) reached`);
            return;
        }

        console.log(`Reconnecting in ${this.reconnectDelay / 1000} seconds (attempt ${this.connectionAttempts})`);
        this.reconnectTimeout = setTimeout(() => this._initialize(), this.reconnectDelay);
    }

    async subscribeToChannels() {
        try {
            const channels = Object.values(CHANNELS);
            console.log(`Subscribing to channels: ${channels.join(', ')}`);

            for (const channel of channels) {
                const sub = this.nc.subscribe(channel);
                this.subscriptions.set(channel, sub);

                (async () => {
                    for await (const msg of sub) {
                        try {
                            await this.handleMessage(msg.subject, this.sc.decode(msg.data));
                        } catch (err) {
                            console.error(`Error processing message on ${channel}:`, err);
                        }
                    }
                })().catch(err => console.error('Subscription stream error:', err));

                console.log(`Subscribed to ${channel}`);
            }
        } catch (err) {
            console.error('Subscription setup failed:', err);
            throw err;
        }
    }

    async handleMessage(channel, rawMessage) {
        try {
            const { sender, data } = JSON.parse(rawMessage);

            if (sender === this.nodeId) {
                console.log(`Ignoring self-message on ${channel}`);
                return;
            }


            switch (channel) {
                case CHANNELS.BLOCKCHAIN:
            console.log(`Received message on ${channel} from node ${sender.slice(0, 8)}...`);

                    console.log('Updating local blockchain...');
                    this.blockchain.replaceChain(data, true, () => {
                          
                        
                        this.transactionPool.clearBlockchainTransactions({ chain: data });
                    });
                    break;

                case CHANNELS.TRANSACTION:
                    //console.log('Adding transaction to pool...');
                    this.transactionPool.setTransaction(data);
                    break;

                case CHANNELS.STATUS:
                    console.log(`Status update from node ${sender.slice(0, 8)}: ${data}`);
                    break;

                default:
                    console.warn(`Unhandled channel: ${channel}`);
            }
        } catch (err) {
            console.error(`Failed to handle message on ${channel}: ${err.message}`);
        }
    }

    async publish({ channel, message }) {
        if (!this.isConnected) {
            console.warn('NATS not connected. Attempting reconnect before publishing...');
            await this._initialize();

            if (!this.isConnected) {
                console.error('Still not connected. Message not sent.');
                return false;
            }
        }

        try {
            const payload = JSON.stringify({
                sender: this.nodeId,
                data: message,
                timestamp: Date.now()
            });

            await this.nc.publish(channel, this.sc.encode(payload));
            console.log(`Published to ${channel}`);
            return true;
        } catch (err) {
            console.error(`Failed to publish on ${channel}:`, err);
            this.isConnected = false;
            this._handleConnectionFailure();
            return false;
        }
    }

    async broadcastChain() {
        return this.publish({
            channel: CHANNELS.BLOCKCHAIN,
            message: this.blockchain.chain
        });
    }

    async broadcastTransaction(transaction) {
        return this.publish({
            channel: CHANNELS.TRANSACTION,
            message: transaction
        });
    }

    async broadcastStatus(statusMessage) {
        return this.publish({
            channel: CHANNELS.STATUS,
            message: statusMessage
        });
    }

    async _safeClose() {
        try {
            if (this.nc && !this.nc.isClosed()) {
                for (const [channel, sub] of this.subscriptions) {
                    sub.unsubscribe();
                    console.log(`Unsubscribed from ${channel}`);
                }

                this.subscriptions.clear();
                await this.nc.drain();
                console.log('NATS connection drained');
            }
        } catch (err) {
            console.error('Error while safely closing NATS:', err);
        }
    }

    async close() {
        await this._safeClose();
        this.isConnected = false;
        console.log('PubSub shutdown complete');
    }
}

module.exports = PubSub;
