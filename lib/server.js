const debug = require('debug')('dns-reverse-proxy:server');

const dgram = require('dgram');

class Server {
    constructor(options) {
        debug("Initializing", options);
        Object.assign(this, options);

        this.id = this.address+":"+this.port;

    }

    async send(request) {
        debug(this.id, request, "Sending");
        return new Promise((resolve, reject) => {
            let udp = dgram.createSocket('udp4');
            udp.on('error', err => { return reject(err); });
            udp.on('message', (response, rinfo) => {
                debug(this.id, request, response, "Receiving");
                clearTimeout(udp.timeout);
                udp.close();
                resolve(response);
            });
            udp.send(request, 0, request.length, this.port, this.address, (err, bytes) => {
                if(err) {
                    reject(err);
                }
            });
            udp.timeout = setTimeout(function() { udp.close(); }, 1000);
        });
    }

}

module.exports = Server;
