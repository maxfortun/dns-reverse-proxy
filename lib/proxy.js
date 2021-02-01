const debug = require('debug')('dns-reverse-proxy:proxy');

const Server = require('./server');

class Proxy {
    constructor(config, id, options) {
        Object.assign(this, options);
        this.config = config;
        this.id = id;

        debug(this.id, "Initializing");
        if(this.servers) { 
            let servers = this.servers.map(serverConfig => new Server(Object.assign({}, this.config.defaults.servers, serverConfig)));
            this.servers = servers;
        }
    }

    async send(request) {
        if(!this.servers || this.servers.length == 0) {
            return null;
        }
        debug(this.id, "Sending");
        return new Promise(async (resolve, reject) => {
            let errors = [];
            let receivedResponse = false;
            for(let i = 0; i < this.servers.length && !receivedResponse; i++) {
                await this.servers[0].send(request)
                .then(response => {
                    receivedResponse = true;
                    return resolve(response);
                })
                .catch(err => { errors.push(err) });
            }
            reject(errors);
        });
    }
}


module.exports = Proxy;
