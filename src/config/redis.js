require('dotenv').config();
const { createClient } = require('redis');

const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.log('Redis Client Error', err));
client.on('connect', () => console.log('Redis Client Connected'));

const connectRedis = async () => {
    if (!client.isOpen) {
        await client.connect();
    }
    return client;
};

const disconnectRedis = async () => {
    if (client.isOpen) {
        await client.quit();
    }
};

module.exports = {
    client,
    connectRedis,
    disconnectRedis
};
