import axios from 'axios';
async function test() {
    const epoch = Math.floor((Date.now() / 1000) / 300) * 300;
    const slug = `btc-updown-5m-${epoch}`;
    const res = await axios.get(`https://gamma-api.polymarket.com/events?slug=${slug}`);
    console.log(JSON.stringify(res.data[0], null, 2));
}
test();
