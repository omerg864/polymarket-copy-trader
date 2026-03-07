import axios from 'axios';
async function test() {
    const epoch = Math.floor(Date.now() / 1000 / 300) * 300;
    const slug = `btc-updown-5m-${epoch}`;
    console.log('Slug:', slug);
    const res = await axios.get(`https://gamma-api.polymarket.com/events?slug=${slug}`);
    const event = res.data[0];
    if (event) {
        console.log('priceToBeat in eventMetadata:', event.eventMetadata?.priceToBeat);
        console.log('markets[0].groupItemTitle:', event.markets?.[0]?.groupItemTitle);
        console.log('Full structure for priceToBeat keys:');
        console.log(JSON.stringify(event.markets[0], null, 2).substring(0, 1500));
    }
}
test();
