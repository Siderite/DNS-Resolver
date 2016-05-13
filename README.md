# DNS-Resolver
Chrome extension to remember previously resolved domain name IPs, in case DNS server goes down or IP is blocked.

It just runs in the background, remembering DNS resolutions (host to IP) until DNS fails. It then counts the number of DNS failures that it has an IP cached for.
Click on the DNS Resolver icon and you can copy/paste the necessary information to copy into the hosts file (which on Windows is in C:/Windows/System32/drivers/etc/hosts) to force the resolution to the known IP.
You can try to "auto replace", which replaces host with the IP, but this will fail in case there are multiple domains on the same IP (as many online platforms).

The extension does not communicate with the outside, but it does cache a list of hosts you visit.