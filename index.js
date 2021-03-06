var oneConcurrent = require("one-concurrent");
var PowerLink2 = require("visonic-powerlink2");

var Service, Characteristic;

module.exports = function(homebridge) {
	
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory("homebridge-visonic-powerlink2", "PowerLink2", PowerLink2Accessory);
};

/**
 * @constructor
 * @param {Function} [log] - Logging function
 * @param {Object} config - Config object, containing a 'name' for the accessory, 'username', 'password', 'host' (e.g. IP address string), and optionally a 'debug' boolean
 */
function PowerLink2Accessory(log, config) {
	let self = this;

	self.log = log;
	self.debug = config.debug;

	self.name = config.name;
	self.pollForChanges = config.pollForChanges || true;
	self.pollingInterval = config.pollingInterval ? config.pollingInterval*1000 : 10*1000;

	let powerLink2Config = {
		host: config.host,
		username: config.username,
		password: config.password,
		debug: config.debug
	};

	self.powerLink2 = new PowerLink2(powerLink2Config, log); // Handles PowerLink2 API calls; independent of Homebridge

	if (self.pollForChanges) {
		self.poll();
	}
}

/**
 * Sets up continued polling of the system state: if the system status gets changed externally (e.g. via a physical keypad), HomeKit will still get notified of the change.
 */
PowerLink2Accessory.prototype.setupPolling = function () {
	var self = this;

	setTimeout(function () {
		self.poll();
	}, self.pollingInterval);
}

/**
 * 	Checks whether the system state has been changed externally, and updates HomeKit with the latest state
 */
PowerLink2Accessory.prototype.poll = function () {
	var self = this;

	var done = function () { 
		self.setupPolling(); // Let's go again!
	};

	self.getCurrentState(function (error, hapState) {

		if (error) {
			self.log(`Error polling: ${error}`);
			done();
			return;
		}

		let stateDescription = self.hapStateToDescription(hapState);

		if (self.previousState == undefined) {
			// Ignore the first poll response; HomeKit will treat it as a state *change*, and notify people

			self.log(`State is currently set to: ${stateDescription}`)
			self.previousState = hapState;
			done();
			return; 
		}

		if (hapState == self.previousState) {
			// State hasn't changed
			done();
			return;
		}

		self.log(`State was externally set to: ${stateDescription}`)

		self.securitySystemService
			.getCharacteristic(Characteristic.SecuritySystemCurrentState)
			.setValue(hapState);

		self.previousState = hapState;

		done();
	});
}

/**
 * Returns the HAP services for the system
 * @return {Array} - A list of Service objects
 */
PowerLink2Accessory.prototype.getServices = function() {
	var self = this;

	let informationService = new Service.AccessoryInformation();
    informationService
		.setCharacteristic(Characteristic.Manufacturer, "Visonic")
		.setCharacteristic(Characteristic.Model, "PowerLink2")
		.setCharacteristic(Characteristic.SerialNumber, "0");

	let securitySystemService = new Service.SecuritySystem(self.name);

	securitySystemService
		.getCharacteristic(Characteristic.SecuritySystemCurrentState)
		.on('get', self.getCurrentState.bind(self));

	securitySystemService
		.getCharacteristic(Characteristic.SecuritySystemTargetState)
		.on('get', self.getCurrentState.bind(self))
		.on('set', self.setTargetState.bind(self));
 
    self.informationService = informationService;
    self.securitySystemService = securitySystemService;
	
	return [informationService, securitySystemService];
}

/**
 * Gets the system state as a HAP Characteristic state
 * @param  {Function} callback - Callback to call with the state (error, hapState)
 */
PowerLink2Accessory.prototype.getCurrentState = function (callback) {
	var self = this;

	self.debugLog(`getCurrentState`);

	oneConcurrent(function (callback) {
		self.powerLink2.getStatus(callback);

	}, function (error, status) {

		if (error) {
			callback(error);
			return;
		}

		var hapMap = {};
		hapMap[PowerLink2.STATUSES.DISARMED] = Characteristic.SecuritySystemCurrentState.DISARMED;
		hapMap[PowerLink2.STATUSES.ARMED_HOME] = Characteristic.SecuritySystemCurrentState.STAY_ARM;
		hapMap[PowerLink2.STATUSES.ARMED_AWAY] = Characteristic.SecuritySystemCurrentState.AWAY_ARM;

		var hapState = hapMap[status]; // Get a HAP state from the provided PowerLink2 status

		if (hapState == undefined) {

			callback(new Error(`There isn't a HAP Characteristic state which corresponds with the PowerLink2's current status – the system may be starting to arm`)); // This scenario happens, for example, when the system has begun arming; allowing people to exit

		} else {

			callback(null, hapState);
		}

		// self.lastState = hapState;
	});
}

/**
 * Sets the system state to a HAP Characteristic state
 * @param {number} hapState - A Characteristic state (e.g. Characteristic.SecuritySystemCurrentState.DISARMED)
 * @param {Function} callback - Callback to call with the state (error, hapState)
 */
PowerLink2Accessory.prototype.setTargetState = function (hapState, callback) {
	var self = this;

	self.debugLog(`setTargetState: ${hapState}`);

	if (hapState == Characteristic.SecuritySystemTargetState.NIGHT_ARM) {

		self.log(`'Night' arm was selected, but that's not supported by PowerLink2, so 'home' arm will be set instead`)

		self.securitySystemService
			.setCharacteristic(Characteristic.SecuritySystemTargetState, 
				Characteristic.SecuritySystemTargetState.STAY_ARM); // This call will result in this whole function being called again with the STAY_ARM state instead

		callback(null);
		return;
	}

	var stateDescription = self.hapStateToDescription(hapState)
	self.log(`Setting security system state to: ${stateDescription}`)

	let powerLinkMap = {
		0: PowerLink2.STATUSES.ARMED_HOME,
        1: PowerLink2.STATUSES.ARMED_AWAY,
        // 2: null, // 'Night' unsupported
        3: PowerLink2.STATUSES.DISARMED
	};

	let powerLinkStatus = powerLinkMap[hapState];

	self.log(`powerLinkStatus to set: ${powerLinkStatus}`);

	if (self.simulateSetting) {

		self.log(`>>> Simulating state setting`);
		setTimeout(function () { 

			callback(null);

			self.securitySystemService
				.setCharacteristic(Characteristic.SecuritySystemCurrentState, hapState);

		}, 2*1000);

		return;
	}

	self.powerLink2.setStatus(powerLinkStatus, function (error) {

		if (!error) {

			self.securitySystemService
				.setCharacteristic(Characteristic.SecuritySystemCurrentState, hapState);
			self.previousState = hapState; // To aid polling
		}

		callback(error);
	})
}

/**
 * Returns a string description for a given HAP Characteristic state
 * 
 * @param  {number} hapState - A HAP Characteristic state
 * @return {string} - Description
 */
PowerLink2Accessory.prototype.hapStateToDescription = function (hapState) {

	var hapStateNumberToDescription = { 0: 'home', 1: 'away', /*2: 'Night',*/ 3: 'off' };
	return hapStateNumberToDescription[hapState]
}

/** 
 * Logging function which will only actually log if self.debug is true. Can be passed anything you'd pass to config.log
 * @param {...*} value - Value to log
 */
PowerLink2Accessory.prototype.debugLog = function () {
	let self = this;

	if (self.debug) 
		self.log.apply(self, arguments);
}