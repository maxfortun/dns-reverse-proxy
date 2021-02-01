#!/usr/bin/env node

const debug = require('debug')('dns-reverse-proxy');

let context = { zones: {}, rates: {} };

let config = context.config = require('./lib/local-config');

let Server = require('./lib/server');
let Proxy = require('./lib/proxy');

Object.keys(config.zones).forEach(name => {
    let tokens = name.split(/\./).reverse();
    if(tokens[0] != "") {
        tokens.unshift("");
    }

    let zone = context.zones;
    tokens.forEach(token => {
        if(!zone[token]) {
            zone[token] = {};
        }
        zone = zone[token];
    });
    
    let zoneConfig = config.zones[name];
    zone[".proxy"] = new Proxy(config, name, zoneConfig);
});

debug(JSON.stringify(context.zones));

function getProxy(name) {
    let tokens = name.split(/\./).reverse();
    if(tokens[0] != "") {
        tokens.unshift("");
    }

    let zone = context.zones;
    let proxy = null;

    tokens.find(token => {
        debug(name, "Checking proxy '"+token+"'");
        if(!zone[token]) {
            return true;
        }
        zone = zone[token];
        if(zone[".proxy"]) {
            proxy = zone[".proxy"];
            debug(name, "Assign proxy", proxy.id);
        }
        return false;
    });

    debug("Proxy for", name, proxy);
    return proxy;
}

const dgram = require('dgram');
const packet = require('native-dns-packet');

function onUDPListening() {
    debug("Listening", context);
}

function onUDPError(err) {
    debug("Error:", err);
}

function onUDPClose() {
    debug("Socket closed");
}

async function onUDPMessage(request, rinfo) {
    debug("Requester", rinfo);

    const query = packet.parse(request);
    debug("Query:", query);

    let proxy = null;
    query.question.forEach(question => {
        let questionProxy = getProxy(question.name);
        if(!proxy) {
            proxy = questionProxy;
            return;
        }
        if(questionProxy.id != proxy.id) {
            throw new Error("Multiple proxies in a single request not supported.");
        }
    });
    
    return proxy.send(request).then(response => { return sendResponse(response, rinfo) });
}

async function sendResponse(response, rinfo) {
    if(!response) {
        debug("Dropping", rinfo);
        return;
    }
    debug("Responding", response);
    udp.send(response, 0, response.length, rinfo.port, rinfo.address);
}

const udp = dgram.createSocket('udp4');

udp.on('listening', onUDPListening);
udp.on('error', onUDPError);
udp.on('message', onUDPMessage);
udp.on('close', onUDPClose);

udp.bind(context.config.bind.port || process.env.BIND_PORT, context.config.bind.address || process.env.BIND_ADDRESS);

