import axios from 'axios';
async function test() {
    const epoch = Math.floor(Date.now() / 1000 / 300) * 300;
    const startTime = epoch * 1000;
    console.log('Fetching BTC price for start time:', new Date(startTime).toISOString());
    const res = await axios.get(`https://api.binance.com/api/v3/klines`, {
        params: {
            symbol: 'BTCUSDT',
            interval: '1m',
            startTime: startTime,
            limit: 1
        }
    });
    console.log(res.data[0]);
    // The open price of the candle is index 1
    if (res.data[0]) {
        console.log('Open Price:', res.data[0][1]);
    }
}
test();
