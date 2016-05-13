var dns;
var options;
function refresh() {
	var divEntries = $('#divEntries').empty();
	var size = JSON.stringify(dns).length;
	var hosts = Object.keys(dns);
	var toReplace = 0;
	var displayed = 0;
	hosts.forEach(function (host) {
		var data = dns[host];
		if (data && (options.showAll || data.replaceHost)) {
			var ips = data.ips;
			var first = true;
			var filter = $('#inpFilter').val();
			var filterApplies = !filter || host.includes(filter.toLowerCase());
			for (var i = ips.length - 1; i >= 0; i--) {
				(function () {
					if (first) {
						toReplace++;
						if (filterApplies)
							displayed++;
					}
					if (filterApplies) {
						var ip = ips[i];
						var line = ip + ' ' + host;
						var entry = $('<div></div>');
						if (first) {
							entry.addClass('active');
							if (data.replaceHost)
								entry.addClass('replaceHost');
						} else {
							line = '#' + line;
							entry.addClass('comment');
						}
						entry.click(function () {
							$('#inpHost').val(host);
							var index = data.ips.indexOf(ip);
							data.ips.splice(index, 1);
							data.ips.push(ip);
							refresh();
							refreshButton();
						});
						divEntries.append(entry.text(line));
					}
					first = false;
				})();
			}
		}
	});
	$('#divInfo').empty()
	.append($('<div></div>').text('Total DNS entries: ' + hosts.length))
	.append($('<div></div>').text('Local only DNS entries: ' + toReplace))
	.append($('<div></div>').text('Displayed entries: ' + displayed))
	.append($('<div></div>').text('DNS entries size: ' + size));
	$('#inpHost').autocomplete("option", "source", hosts);
	$('#divTodo').toggle(!options.showAll);
}

function getHost() {
	var host = $('#inpHost').val();
	if (!host)
		return;
	host = host.toLowerCase();
	return host;
}

function refreshButton() {
	var host = getHost();
	var text;
	var enabled = false;
	if (host) {
		var data = dns[host];
		if (data) {
			text = !data.replaceHost
				 ? "Add to hosts"
				 : "Remove from hosts";
			enabled = true;
		} else {
			text = "Not in entries list";
			enabled = false;
		}
	} else {
		text = "Enter a host";
	}
	$('#btnStatus').text(text).prop('disabled', !enabled);
	$('#inpHost').attr('size', $('#inpHost').val().length);
}

$(function () {
	chrome.runtime.getBackgroundPage(function (bgPage) {
		options = bgPage.options;
		dns = bgPage.dns;
		$('#chkDebug')
		.prop('checked', options.debug)
		.click(function () {
			options.debug = $(this).is(':checked');
		});
		$('#chkAutoreplace')
		.prop('checked', options.autoreplace)
		.click(function () {
			options.autoreplace = $(this).is(':checked');
		});
		$('#chkShowAll')
		.prop('checked', options.showAll)
		.click(function () {
			options.showAll = $(this).is(':checked');
			refresh();
		});
		$('#btnClearData')
		.click(function () {
			if (!confirm('This will delete all stored DNS entries. Continue?'))
				return;
			dns = {};
			bgPage.dns = dns;
			refresh();
			bgPage.displayHostsToReplace();
		});
		$('#inpHost').on('keyup paste', function () {
			refreshButton();
		});
		$('#inpFilter').on('keyup paste', function () {
			refresh();
		});
		$('#btnStatus').click(function () {
			var host = getHost();
			var data = dns[host];
			bgPage.replaceHost(host, !data || !data.replaceHost);
			refresh();
			refreshButton();
		});
		$('#inpHost').autocomplete({
			select : function () {
				setTimeout(refreshButton, 1);
			}
		});
		refresh();
		refreshButton();
	});
});