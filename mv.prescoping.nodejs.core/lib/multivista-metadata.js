const https = require('https');
const { unzip } = require('zlib');

exports.getPhotos = function (shootTypeId, dateTaken, credentials) {

    if (!credentials || !credentials.username || !credentials.password) {
        throw 'Incorrect credential object, should be {username: ... , password: ..., url: ...}';
    }

    const options = {
        hostname: 'mds.multivista.com',
        path: '/index.cfm?fuseaction=aAPI.getPhotos&ShootTypeID=' + shootTypeId + '&Date=' + dateTaken,
        method: 'GET',
        headers: {
            'Authorization': 'Basic ' + new Buffer.from(credentials.username + ':' + credentials.password).toString('base64'),
            'Accept-Encoding': 'gzip'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            const chunks = [];
            res.on('data', data => {
                chunks.push(data)
            });
            res.on('end', () => {
                let body = Buffer.concat(chunks);

                unzip(body, (err, buffer) => {

                    if (err) {
                        process.exitCode = 1;
                        reject(err);
                    }

                    if (res.headers['content-type'].indexOf('application/json') != -1) {
                        const jsonString = buffer.toString();
                        resolve(JSON.parse(jsonString));
                    } else {
                        reject('Unsupported content type: ' + res.headers['content-type']);
                    }
                });
            });
        })

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}