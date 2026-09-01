import { App, MarkdownView, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';

interface AutoTyperSettings {
	delayBetweenChars: number;
	autoStart: boolean;
}

const DEFAULT_SETTINGS: AutoTyperSettings = {
	delayBetweenChars: 150,
	autoStart: false
}

export default class AutoTyperPlugin extends Plugin {
	settings: AutoTyperSettings;
	private isTyping: boolean = false;
	private typingTimeout: number | null = null;
	private clipboardCheckInterval: number | null = null;

	constructor(app: App, manifest: any) {
		super(app, manifest);
		this.settings = DEFAULT_SETTINGS;
	}

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'auto-typer-type-clipboard',
			name: 'Type text from clipboard',
			callback: () => this.typeClipboardContent()
		});

		this.addCommand({
			id: 'auto-typer-stop',
			name: 'Stop typing',
			callback: () => this.stopTyping()
		});

		this.addSettingTab(new AutoTyperSettingTab(this.app, this));

		if (this.settings.autoStart) {
			this.startClipboardMonitoring();
		}

		console.log('Auto Typer Plugin loaded!');
	}


	async typeClipboardContent() {
		if (this.isTyping) {
			new Notice('Already typing! Use "Stop typing" first.');
			return;
		}

		let textToType = '';
		try {
			textToType = await navigator.clipboard.readText();
			if (!textToType || textToType.trim() === '') {
				new Notice('Empty clipboard! Copy something first.');
				return;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			new Notice('Error reading clipboard: ' + errorMessage);
			return;
		}

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			new Notice('Open a note first!');
			return;
		}

		const editor = view.editor;
		this.isTyping = true;
		let index = 0;

		new Notice(`Initializing typing of ${textToType.length} characters...`);

		const typeNextChar = () => {
			if (!this.isTyping || index >= textToType.length) {
				this.isTyping = false;
				if (index >= textToType.length) {
					new Notice('Typing completed!');
				}
				return;
			}

			const cursor = editor.getCursor();
			const char = textToType[index];

			if (char === '\n') {
				editor.replaceRange('\n', cursor);
				const newCursor = { line: cursor.line + 1, ch: 0 };
				editor.setCursor(newCursor);
			} else {
				editor.replaceRange(char, cursor);
				const newCursor = { line: cursor.line, ch: cursor.ch + 1 };
				editor.setCursor(newCursor);
			}

			index++;

			this.typingTimeout = window.setTimeout(typeNextChar, this.settings.delayBetweenChars);
		};

		typeNextChar();
	}

	stopTyping() {
		if (this.isTyping) {
			this.isTyping = false;
			if (this.typingTimeout) {
				clearTimeout(this.typingTimeout);
				this.typingTimeout = null;
			}
			new Notice('Typing interrupted!');
		} else {
			new Notice('No typing in progress.');
		}
	}

	startClipboardMonitoring() {
		if (this.clipboardCheckInterval) {
			clearInterval(this.clipboardCheckInterval);
		}

		let lastClipboardContent = '';

		this.clipboardCheckInterval = window.setInterval(async () => {
			try {
				const currentContent = await navigator.clipboard.readText();
				if (currentContent && currentContent !== lastClipboardContent) {
					lastClipboardContent = currentContent;
					if (!this.isTyping) {
						this.typeClipboardContent();
					}
				}
			} catch (error) {
			}
		}, 1000);

		console.log('Auto Typer: Clipboard monitoring started');
	}

	stopClipboardMonitoring() {
		if (this.clipboardCheckInterval) {
			clearInterval(this.clipboardCheckInterval);
			this.clipboardCheckInterval = null;
			console.log('Auto Typer: Clipboard monitoring stopped');
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.settings.autoStart) {
			this.startClipboardMonitoring();
		} else {
			this.stopClipboardMonitoring();
		}
	}
}

class AutoTyperSettingTab extends PluginSettingTab {
	plugin: AutoTyperPlugin;

	constructor(app: App, plugin: AutoTyperPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Typing Speed')
			.addSlider(slider => slider
				.setLimits(10, 500, 5)
				.setValue(this.plugin.settings.delayBetweenChars)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.delayBetweenChars = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Start')
			.setDesc('Start typing automatically when the clipboard content changes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoStart)
				.onChange(async (value) => {
					this.plugin.settings.autoStart = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Speed Example')
			.setDesc('Example text to test the typing speed (50 characters)')
			.addButton(button => button
				.setButtonText('Test Speed')
				.onClick(async () => {
					const testText = 'This is a speed test for automatic typing.';
					try {
						await navigator.clipboard.writeText(testText);
						await this.plugin.typeClipboardContent();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : 'Unknown error';
						new Notice('Error testing speed: ' + errorMessage);
					}
				}));
	}
}
