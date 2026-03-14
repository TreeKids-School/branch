const fs = require('fs');
const https = require('https');
const path = require('path');

const url = "https://lh3.googleusercontent.com/d/1_T1M91b-6vV42-gB7fE0-UIfS-cEq9Jz";

const paths = [
    path.join(__dirname, '..', 'apple-touch-icon.png'),
    path.join(__dirname, 'public', 'apple-touch-icon.png')
];

https.get(url, (res) => {
    if (res.statusCode !== 200) {
        console.error(`Failed to download: ${res.statusCode}`);
        return;
    }

    const data = [];
    res.on('data', chunk => data.push(chunk));

    res.on('end', () => {
        const buffer = Buffer.concat(data);
        paths.forEach(p => {
            fs.writeFileSync(p, buffer);
            console.log(`Saved to ${p}`);
        });
    });
}).on('error', err => {
    console.error(`Error downloading: ${err.message}`);
});
