# homebridge-visonic-powerlink2

<img src="https://media.giphy.com/media/dZx8gTNz7BlZ2bWkeO/giphy.gif" align="right" alt="Screen recording of a HomeKit Security System state being changed">

This [Homebridge](https://github.com/nfarina/homebridge) plugin allows [Visonic](http://visonic.com) security systems, which have the optional [PowerLink2](http://www.visonic.com/Products/Wireless-Property-Protection/powerlink2-communication-modules) module inside, to be controlled using [Apple HomeKit](https://developer.apple.com/homekit/) (e.g. [in the Home app on iOS, and via Siri](https://www.apple.com/uk/ios/home/))

[Homebridge](https://github.com/nfarina/homebridge) acts as a bridge between HomeKit (on your Apple devices) and (non-HomeKit-supporting) accessories you have. If you don't already have a computer that can be left running Homebridge continuously at home, [you could set up Homebridge on a Raspberry Pi](https://github.com/nfarina/homebridge/wiki/Running-HomeBridge-on-a-Raspberry-Pi).

## Install

1. Install Homebridge by following its [installation steps](https://github.com/nfarina/homebridge#installation)
2. Install this plugin: `npm install -g homebridge-visonic-powerlink2`
3. Edit your Homebridge `config.json` file (`~/.homebridge/config.json` on macOS and Linux), adding your security system to `accessories` – see the sample below

## Configuration

**Configuration sample:**

 ```javascript
	"accessories": [

		{
			"accessory": "PowerLink2",
			"name": "Security System",

			"host": "10.0.1.200",
			"username": "your-username",
			"password": "your-password"
		}
	]
```

**Required parameters:**

* `host` **string** – The IP address, or hostname, of the PowerLink2. (The IP address will match your router's, but with the last block being `.200`, if DHCP is used)

* `username` **string** and `password` **string** – The details to log into the PowerLink2 with. By default, they're `Admin` and `Admin123` respectively. (Be sure to change the password!)

**Optional parameters:**

* `pollForChanges` **boolean** – Turns on continued polling of the system state: if the system status gets changed externally (e.g. via a physical keypad), HomeKit will still get notified of the change (default: `true`)

* `pollingInterval` **number** – How long, in seconds, to wait between each poll. Each poll seems quite intensive on the PowerLink2; a value of 10 seconds or greater is recommended to avoid it going unresponsive & restarting. (default: `10`)

* `debug` **boolean** – Turns on extensive logging, to help debug issues, when set to `true` (default: `false`)