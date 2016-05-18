var options = {
	debug : false,
	autoreplace : false,
	suffix: '.dnscache'
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

function getHostData(url) {
	var m = /^(?:(\w+):)?\/\/([^\/\?#]+)/.exec(url);
	if (!m || !m[2]) {
		debug('Could not find host for: ' + url);
		return null;
	}
	var result = {
		scheme:m[1],
		initialHost:m[2],
		host:m[2],
		forceReplace:false
	};
	if (result.host.endsWith(options.suffix)) {
		result.host=result.host.substr(0,result.host.length-options.suffix.length);
		result.forceReplace=true;
	}
	return result;
}

function isNetError(error) {
	switch (error) {
	case 'net::ERR_NAME_NOT_RESOLVED':
	case 'net::ERR_CONNECTION_REFUSED':
//	case 'net::DNS_PROBE_FINISHED_NXDOMAIN':
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
	var hostData = getHostData(details.url);
	if (!hostData)
		return;
	var ip = details.ip;
	if (ip == hostData.host)
		return;
	if (ip) {
		debug(hostData.host + ' resolved to ' + ip);
		addIp(hostData.host, ip);
	}
}, {
	urls : ["<all_urls>"]
},
	[]);

var requests={};

chrome.webRequest.onBeforeRequest.addListener(function (details) {
	var hostData = getHostData(details.url);
	if (!hostData)
		return;
	if (!options.autoreplace&&!hostData.forceReplace)
		return;
	var data = dns[hostData.host];
	if (!data || !data.ips.length || (!data.replaceHost&&!hostData.forceReplace))
		return;
	if (hostData.scheme=='https') {
		debug('cannot replace host with https protocol: '+hostData.initialHost);
		return {
			//cancel:true,
			redirectUrl : chrome.extension.getURL('httpsErrorPage.html')
		};
	}
	var ip = data.ips[data.ips.length - 1];
	setToRed(details.tabId);
	var newUrl = details.url.replace(hostData.initialHost, ip);
	debug(hostData.host + ' had DNS resolution problems. Attempting to use ' + ip);
	debug(details.url + ' -> ' + newUrl);
	var result = {
		redirectUrl : newUrl
	};
	requests[ip]=hostData;
	return result;
}, {
	urls : ["<all_urls>"]
},
	["blocking"]);

chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
	var hostData=getHostData(details.url);
	if (!hostData) return;
	var ip=hostData.host; //already replaced
	hostData = requests[ip];
	if (!hostData)
		return;
	if (!options.autoreplace&&!hostData.forceReplace) {
		delete requests[ip];
		return;
	}
    details.requestHeaders.push({ name: "Host", value: hostData.host });
    return {requestHeaders: details.requestHeaders};
}, {
	urls : ["<all_urls>"]
},
	["blocking", "requestHeaders"]);

chrome.webRequest.onErrorOccurred.addListener(function (details) {
	var hostData = getHostData(details.url);
	var error = details.error;
	if (!isNetError(error))
		return;
	debug('DNS error:', hostData.host);
	var data = dns[hostData.host];
	if (!data || !data.ips.length)
		return;
	var ip = data.ips[data.ips.length - 1];
	if (ip == hostData.host) {
		debug('Obsolete DNS resolution: ' + hostData.host + ' to ' + ip + '. Removing it.');
		replaceHost(hostData.host, false);
		deleteIp(hostData.host, ip);
	} else {
		debug('Previously working IP: ' + ip + '. Attempting to replace from now on');
		replaceHost(hostData.host, true);
		setToRed(details.tabId);
	}
}, {
	urls : ["<all_urls>"]
});
