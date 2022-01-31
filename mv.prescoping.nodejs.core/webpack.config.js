const path = require('path');

module.exports = {
    entry: './lib/psulib.js',
    output: {
        filename: 'mv.prescoping.nodejs.core.psulib.js',
        path: path.resolve(__dirname, '../mv.prescoping.webapp/wwwroot/js'),
        library: 'PSULIB'
    }
};