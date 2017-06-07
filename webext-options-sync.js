// https://github.com/bfred-it/webext-options-sync

class OptSync {
	constructor(storageName = 'options') {
		this.storageName = storageName;
		this.storage = chrome.storage.sync || chrome.storage.local;
	}

	define(defs) {
		defs = Object.assign({
			defaults: {},
			migrations: [],
		}, defs);

		if (chrome.runtime.onInstalled) {
			chrome.runtime.onInstalled.addListener(() => this._applyDefinition(defs));
		} else {
			this._applyDefinition(defs);
		}
	}

	_applyDefinition(defs) {
		this.getAll().then(options => {
			console.info('Existing options:', options);
			if (defs.migrations.length > 0) {
				console.info('Running', defs.migrations.length, 'migrations');
				defs.migrations.forEach(migrate => migrate(options, defs.defaults));
			}
			const newOptions = Object.assign(defs.defaults, options);
			this.setAll(newOptions);
		});
	}

	getAll() {
		return new Promise(resolve => {
			this.storage.get(this.storageName,
				keys => resolve(keys[this.storageName] || {})
			);
		});
	}

	setAll(newOptions) {
		return new Promise(resolve => {
			this.storage.set({
				[this.storageName]: newOptions,
			}, resolve);
		});
	}

	set(newOptions) {
		return this.getAll().then(options => {
			this.setAll(Object.assign(options, newOptions));
		});
	}

	syncForm(form) {
		this.getAll().then(options => OptSync._applyToForm(options, form));
		form.addEventListener('input', e => this._handleFormUpdates(e));
		form.addEventListener('change', e => this._handleFormUpdates(e));
	}

	static _applyToForm(options, form) {
		for (const name of Object.keys(options)) {
			const options = form.querySelectorAll(`[name="${name}"]`);
			const [field] = options;
			if (field) {
				console.info('Set option', name, 'to', options[name]);
				switch (field.type) {
					case 'checkbox':
						field.checked = options[name];
						break;
					case 'radio': {
						const [selected] = Array.from(options)
						.filter(el => el.value === options[name]);
						if (selected) {
							selected.checked = true;
						}
						break;
					}
					default:
						field.value = options[name];
						break;
				}
			} else {
				console.warn('Stored option {', name, ':', options[name], '} was not found on the page');
			}
		}
	}

	_handleFormUpdates(e) {
		const el = e.target;
		const name = el.name;
		let value = el.value;
		switch (el.type) {
			case 'select-one':
				value = el.options[el.selectedIndex].value;
				break;
			case 'checkbox':
				value = el.checked;
				break;
			default: break;
		}
		console.info('Saving option', el.name, 'to', value);
		this.set({
			[name]: value,
		});
	}
}

OptSync.migrations = {
	removeUnused(options, defaults) {
		for (const key of Object.keys(options)) {
			if (!(key in defaults)) {
				delete options[key];
			}
		}
	}
};

if (typeof module === 'object') {
	module.exports = OptSync;
}