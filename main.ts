import { Plugin, requestUrl, Notice, PluginSettingTab, Setting, TFile, App } from 'obsidian';

interface QuickShareNotePluginSettings {
	githubToken: string;
	imgurClientId: string;
	showFrontmatter: boolean; // Add this line
}

const DEFAULT_SETTINGS: QuickShareNotePluginSettings = {
	githubToken: '',
	imgurClientId: '',
	showFrontmatter: true // Add this line
};

export default class QuickShareNotePlugin extends Plugin {
	settings: QuickShareNotePluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new QuickShareNoteSettingTab(this.app, this));

		this.addCommand({
			id: 'publish-note-to-gist',
			name: 'Publish Note to GitHub Gist',
			callback: () => this.publishNoteToGist(),
		});
	}

	async publishNoteToGist() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file found');
			return;
		}

		const notice = new Notice(`Uploading Notes and Images: ${activeFile.name}...`, 0); // Include file name
		let fileContent = await this.app.vault.read(activeFile);
		let updatedContent = await this.uploadImagesAndReplaceLinks(fileContent);

		if (!this.settings.showFrontmatter) {
			updatedContent = updatedContent.replace(/^---\n[\s\S]*?\n---\n/, ''); // Remove frontmatter if setting is false
		}

		const frontmatterMatch = updatedContent.match(/^---\n[\s\S]*?\n---\n/);
		const frontmatter = frontmatterMatch ? frontmatterMatch[0] : '';
		const contentWithoutFrontmatter = updatedContent.replace(frontmatter, '');
		const fileNameWithoutSuffix = activeFile.name.replace(/\.[^/.]+$/, ''); // Remove file suffix
		const header = `# ${fileNameWithoutSuffix}\n\n`;
		const contentToPublish = frontmatter + header + contentWithoutFrontmatter;

		const response = await requestUrl({
			url: 'https://api.github.com/gists',
			method: 'POST',
			headers: {
				Authorization: `token ${this.settings.githubToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				files: {
					[activeFile.name]: {
						content: contentToPublish,
					},
				},
				public: true,
			}),
		});

		const gistUrl = response.json.html_url;
		this.copyLinkToClipboard(gistUrl);
		await this.updateFrontmatter(activeFile, gistUrl);
		notice.hide();
		new Notice('Note published to GitHub Gist');
	}

	async addHeaderToContent(file: TFile) {
		const fileContent = await this.app.vault.read(file);
		const header = `# ${file.name}\n\n`;
		const newContent = header + fileContent;
		await this.app.vault.modify(file, newContent);
	}

	async updateFrontmatter(file: TFile, url: string) {
		const fileContent = await this.app.vault.read(file);
		const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
		const match = frontmatterRegex.exec(fileContent);
		let newContent;

		if (match) {
			const frontmatter = match[1];
			const updatedFrontmatter = frontmatter.includes('publishUrl')
				? frontmatter.replace(/publishUrl: .*/, `publishUrl: ${url}`)
				: `${frontmatter}\npublishUrl: ${url}`;
			newContent = fileContent.replace(frontmatterRegex, `---\n${updatedFrontmatter}\n---`);
		} else {
			newContent = `---\npublishUrl: ${url}\n---\n${fileContent}`;
		}

		await this.app.vault.modify(file, newContent);
	}

	async uploadImagesAndReplaceLinks(content: string): Promise<string> {
		const imageRegex = /!\[\[(.*?)\]\]/g;
		const activeFile = this.app.workspace.getActiveFile();
		const notePath = activeFile ? activeFile.path.replace(/[^/]+$/, '') : '';
		let match;
		while ((match = imageRegex.exec(content)) !== null) {
			const imagePath = `${notePath}/attachments/${match[1]}`;
			const imageData = await this.app.vault.adapter.readBinary(imagePath);
			const imageUrl = await this.uploadImageToImgur(imageData);
			content = content.replace(match[0], `![Uploaded Image](${imageUrl})`);
		}
		return content;
	}

	async uploadImageToImgur(imageData: ArrayBuffer): Promise<string> {
		const response = await requestUrl({
			url: 'https://api.imgur.com/3/image',
			method: 'POST',
			body: imageData,
			headers: {
				Authorization: `Client-ID ${this.settings.imgurClientId}`,
				'Content-Type': 'application/octet-stream',
			},
		});
		return response.json.data.link;
	}

	copyLinkToClipboard(link: string) {
		navigator.clipboard.writeText(link).then(() => {
			new Notice('Gist URL copied to clipboard');
		}, (err) => {
			new Notice('Failed to copy Gist URL to clipboard');
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class QuickShareNoteSettingTab extends PluginSettingTab {
	plugin: QuickShareNotePlugin;

	constructor(app: App, plugin: QuickShareNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'QuickShareNote Plugin Settings' });

		new Setting(containerEl)
			.setName('GitHub Token')
			.setDesc('Enter your GitHub token')
			.addText(text => text
				.setPlaceholder('Enter your token')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Imgur Client ID')
			.setDesc('Enter your Imgur client ID')
			.addText(text => text
				.setPlaceholder('Enter your client ID')
				.setValue(this.plugin.settings.imgurClientId)
				.onChange(async (value) => {
					this.plugin.settings.imgurClientId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl) // Add this block
			.setName('Show Frontmatter')
			.setDesc('Show frontmatter in published note')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showFrontmatter)
				.onChange(async (value) => {
					this.plugin.settings.showFrontmatter = value;
					await this.plugin.saveSettings();
				}));
	}
}
