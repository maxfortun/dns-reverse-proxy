#!/usr/bin/env node

const debug = require('debug')('dns-reverse-proxy:debug');
const info = require('debug')('dns-reverse-proxy:info');
const warn = require('debug')('dns-reverse-proxy:warn');
const error = require('debug')('dns-reverse-proxy:error');

let context = { zones: {}, rates: {} };

let config = context.config = require('./lib/local-config');

context.config.bind.port = context.config.bind.port || process.env.BIND_PORT;
context.config.bind.address = context.config.bind.address || process.env.BIND_ADDRESS;

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
        if(!zone[token]) {
            return true;
        }
        zone = zone[token];
        if(zone[".proxy"]) {
            proxy = zone[".proxy"];
        }
        return false;
    });

    debug("Proxy for", name, proxy);
    return proxy;
}

const dgram = require('dgram');
const packet = require('native-dns-packet');

function onUDPListening() {
    info("Listening", context);
}

function onUDPError(err) {
    error("Error:", err);
}

function onUDPClose() {
    warn("Socket closed");
}

async function onUDPMessage(request, rinfo) {
    const query = packet.parse(request);
    info("Request:", JSON.stringify(query), JSON.stringify(rinfo));

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
        warn("Dropping", rinfo);
        return;
    }
    const responseObject = packet.parse(response);
    info("Response:", JSON.stringify(responseObject), JSON.stringify(rinfo));
    udp.send(response, 0, response.length, rinfo.port, rinfo.address);
}

const udp = dgram.createSocket('udp4');

udp.on('listening', onUDPListening);
udp.on('error', onUDPError);
udp.on('message', onUDPMessage);
udp.on('close', onUDPClose);

udp.bind(context.config.bind.port, context.config.bind.address);

