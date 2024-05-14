const axios = require('axios');
const fs = require('fs');
const path = require('path');

const urlPart = process.argv[2];

if (!urlPart) {
    console.error('Please provide the URL part as a command-line argument.');
    process.exit(1);
}

const url = `http://172.17.10.10:8080/?jps=jobs&jobid=${urlPart}`;
const savePath = path.join(__dirname, 'jobs', `${urlPart}.xml`);

axios.get(url, { responseType: 'text' })  // Expect a text response
    .then(response => {
        if (!fs.existsSync(path.dirname(savePath))) {
            fs.mkdirSync(path.dirname(savePath), { recursive: true });
        }

        fs.writeFile(savePath, response.data, (err) => {
            if (err) throw err;
            console.log('Data saved successfully!');
        });
    })
    .catch(error => {
        console.error('Error fetching data: ', error);
    });
