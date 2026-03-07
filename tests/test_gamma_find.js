import axios from 'axios';
async function test() {
    const epoch = Math.floor(Date.now() / 1000 / 300) * 300;
    const slug = `btc-updown-5m-${epoch}`;
    console.log('Slug:', slug);
    const res = await axios.get(`https://gamma-api.polymarket.com/events?slug=${slug}`);
    
    // Dump the whole thing as a string and search for "priceToBeat" or "strike" or "reference"
    const jsonStr = JSON.stringify(res.data, null, 2);
    
    const lines = jsonStr.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('price') || line.includes('beat') || line.includes('strike') || line.includes('ref')) {
            console.log(`Line ${i}: ${lines[i].trim()}`);
        }
    }
}
test();
