const debug = require('debug')('dns-reverse-proxy:server:debug');

const dgram = require('dgram');
const packet = require('native-dns-packet');

class Server {
    constructor(options) {
        debug("Initializing", options);
        Object.assign(this, options);

        this.id = this.address+":"+this.port;

    }

    async send(request) {
        const requestObject = packet.parse(request);
        debug(this.id, "Request:", JSON.stringify(requestObject));
        return new Promise((resolve, reject) => {
            let udp = dgram.createSocket('udp4');
            udp.on('error', err => { return reject(err); });
            udp.on('message', (response, rinfo) => {
                const responseObject = packet.parse(response);
                debug(this.id, "Response:", JSON.stringify(responseObject));

                clearTimeout(udp.timeout);
                udp.close();
                resolve(response);
            });
            udp.send(request, 0, request.length, this.port, this.address, (err, bytes) => {
                if(err) {
                    reject(err);
                }
            });
            udp.timeout = setTimeout(function() {
                                debug(this.id, request, response, "Timed out");
                                udp.close(); 
                            }, 1000);
        });
    }

}

module.exports = Server;
