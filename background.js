var options = {
	debug : false,
	autoreplace : false
};
var dns = {};
chrome.storage.local.get('DNShosts', function (data) {
	dns = data.DNShosts || {};
	displayHostsToReplace();
});

function debug() {
	if (!options.debug)
		return;
	console.log.apply(console, arguments);
}

function addIp(host, ip) {
	if (!host)
		return;
	host = host.toLowerCase();
	var data = dns[host];
	if (!data || !data.ips) {
		data = {
			ips : []
		};
		dns[host] = data;
	}
	if (!data.ips.includes(ip))
		data.ips.push(ip);
	chrome.storage.local.set({
		'DNShosts' : dns
	});
}

function deleteIp(host, ip) {
	if (!host)
		return;
	host = host.toLowerCase();
	var data = dns[host];
	if (!data || !data.ips)
		return;
	var index = data.ips.indexOf(ip);
	if (index < 0)
		return;
	data.ips.splice(index, 1);
	chrome.storage.local.set({
		'DNShosts' : dns
	});
}

function replaceHost(host, value) {
	if (!host)
		return;
	host = host.toLowerCase();
	if (typeof(value) === 'undefined')
		value = true;
	var data = dns[host];
	if (!data) {
		data = {
			ips : []
		};
		dns[host] = data;
	}
	data.replaceHost = value;
	chrome.storage.local.set({
		'DNShosts' : dns
	});
	displayHostsToReplace();
}

function countHostsToReplace() {
	var count = Object.keys(dns).filter(function (host) {
			return dns[host].replaceHost;
		}).length;
	return count ? count.toString() : '';
}

function getHost(url) {
	var m = /^(\w+:)?\/\/([^\/\?#]+)/.exec(url);
	if (!m || !m[2]) {
		debug('Could not find host for: ' + url);
		return null;
	}
	return m[2];
}

function isNetError(error) {
	switch (error) {
	case 'net::ERR_NAME_NOT_RESOLVED':
	case 'net::ERR_CONNECTION_REFUSED':
		return true;
	default:
		return false;
	}
}

function setToRed(tabId) {
	chrome.browserAction.setIcon({
		path : 'icon_red.png',
		tabId : tabId
	});
}

function displayHostsToReplace(tabId) {
	chrome.browserAction.setBadgeBackgroundColor({
		tabId : tabId,
		color : [190, 190, 230, 190]
	});
	chrome.browserAction.setBadgeText({
		tabId : tabId,
		text : countHostsToReplace()
	});
}

chrome.browserAction.onClicked.addListener(function () {
	chrome.tabs.create({
		url : 'hosts.html'
	});
});

chrome.webRequest.onCompleted.addListener(function (details) {
	delete requests[details.requestId];
	var host = getHost(details.url);
	if (!host)
		return;
	var ip = details.ip;
	if (ip == host)
		return;
	if (ip) {
		debug(host + ' resolved to ' + ip);
		addIp(host, ip);
	}
}, {
	urls : ["<all_urls>"]
},
	[]);

var requests={};

chrome.webRequest.onBeforeRequest.addListener(function (details) {
	if (!options.autoreplace)
		return;
	var host = getHost(details.url);
	if (!host)
		return;
	var data = dns[host];
	if (!data || !data.replaceHost || !data.ips.length)
		return;
	var ip = data.ips[data.ips.length - 1];
	setToRed(details.tabId);
	var newUrl = details.url.replace(host, ip);
	debug(host + ' had DNS resolution problems. Attempting to use ' + ip);
	debug(details.url + ' -> ' + newUrl);
	var result = {
		redirectUrl : newUrl
	};
	requests[details.requestId]=host;
	return result;
}, {
	urls : ["<all_urls>"]
},
	["blocking"]);

chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
	if (!options.autoreplace)
		return;
	var host = requests[details.requestId];
	if (!host)
		return;
    details.requestHeaders.push({ name: "Host", value: host });
    return {requestHeaders: details.requestHeaders};
}, {
	urls : ["<all_urls>"]
},
	["blocking", "requestHeaders"]);

chrome.webRequest.onErrorOccurred.addListener(function (details) {
	delete requests[details.requestId];
	var host = getHost(details.url);
	var error = details.error;
	if (!isNetError(error))
		return;
	debug('DNS error:', host);
	var data = dns[host];
	if (!data || !data.ips.length)
		return;
	var ip = data.ips[data.ips.length - 1];
	if (ip == host) {
		debug('Obsolete DNS resolution: ' + host + ' to ' + ip + '. Removing it.');
		replaceHost(host, false);
		deleteIp(host, ip);
	} else {
		debug('Previously working IP: ' + ip + '. Attempting to replace from now on');
		replaceHost(host, true);
		setToRed(details.tabId);
	}
}, {
	urls : ["<all_urls>"]
});