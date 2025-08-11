import { Plugin, requestUrl, Notice, PluginSettingTab, Setting, TFile, App } from 'obsidian';

interface QuickShareNotePluginSettings {
	githubToken: string;
	imgurClientId: string;
	showFrontmatter: boolean;
	// Markdown compatibility settings
	compatibilityMode: 'strict' | 'permissive';
	preserveWikilinks: boolean;
	convertTags: boolean;
	convertCallouts: boolean;
	handleMath: 'remove' | 'convert' | 'preserve';
	handlePluginContent: 'remove' | 'convert';
	showCompatibilityReport: boolean;
}

const DEFAULT_SETTINGS: QuickShareNotePluginSettings = {
	githubToken: '',
	imgurClientId: '',
	showFrontmatter: true,
	// Default compatibility settings - permissive mode
	compatibilityMode: 'permissive',
	preserveWikilinks: false,
	convertTags: true,
	convertCallouts: true,
	handleMath: 'convert',
	handlePluginContent: 'convert',
	showCompatibilityReport: true
};

// API endpoints
const GITHUB_API_URL = 'https://api.github.com/gists';
const IMGUR_API_URL = 'https://api.imgur.com/3/image';

// Frontmatter handling interface
interface FrontmatterData {
	frontmatter: string;
	content: string;
	hasFrontmatter: boolean;
}

// Markdown compatibility interfaces
interface ConversionResult {
	convertedContent: string;
	warnings: string[];
	removedElements: string[];
	changedElements: { original: string; converted: string; type: string; }[];
}

interface MarkdownVariant {
	name: string;
	description: string;
	detector: (content: string) => boolean;
	converter: (content: string, options?: ConversionOptions) => ConversionResult;
}

interface ConversionOptions {
	compatibilityMode: 'strict' | 'permissive';
	preserveWikilinks: boolean;
	convertTags: boolean;
	convertCallouts: boolean;
	handleMath: 'remove' | 'convert' | 'preserve';
	handlePluginContent: 'remove' | 'convert';
}

interface CompatibilityReport {
	detectedVariants: string[];
	conversionResults: ConversionResult;
	compatibilityScore: number; // 0-100
	recommendations: string[];
}

// Markdown Compatibility Handler
class MarkdownCompatibilityHandler {
	private variants: MarkdownVariant[];
	
	constructor() {
		this.variants = this.initializeVariants();
	}
	
	private initializeVariants(): MarkdownVariant[] {
		return [
			{
				name: 'Obsidian Wikilinks',
				description: 'Internal links using [[]] syntax',
				detector: (content: string) => /\[\[(?!\!)[^\]]+\]\]/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertWikilinks(content, options)
			},
			{
				name: 'Obsidian Image Wikilinks',
				description: 'Image embeds using ![[]] syntax',
				detector: (content: string) => /!\[\[[^\]]+\]\]/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertImageWikilinks(content, options)
			},
			{
				name: 'Obsidian Tags',
				description: 'Tags using #hashtag syntax',
				detector: (content: string) => /#[\w\-\/]+(?:\s|$|[^\w\-\/])/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertTags(content, options)
			},
			{
				name: 'Obsidian Callouts',
				description: 'Callouts using > [!type] syntax',
				detector: (content: string) => />\s*\[![\w\-]+\]/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertCallouts(content, options)
			},
			{
				name: 'Math Expressions',
				description: 'LaTeX math using $$ or $ syntax',
				detector: (content: string) => /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertMath(content, options)
			},
			{
				name: 'Plugin Content',
				description: 'Mermaid, Dataview, and other plugin syntax',
				detector: (content: string) => /```(?:mermaid|dataview|ad-|query)/.test(content) || /%%[\s\S]*?%%/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertPluginContent(content, options)
			}
		];
	}
	
	analyzeContent(content: string): CompatibilityReport {
		const detectedVariants: string[] = [];
		let totalConversionResult: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};
		
		// Detect variants
		for (const variant of this.variants) {
			if (variant.detector(content)) {
				detectedVariants.push(variant.name);
			}
		}
		
		// Calculate compatibility score
		const compatibilityScore = this.calculateCompatibilityScore(detectedVariants);
		
		// Generate recommendations
		const recommendations = this.generateRecommendations(detectedVariants);
		
		return {
			detectedVariants,
			conversionResults: totalConversionResult,
			compatibilityScore,
			recommendations
		};
	}
	
	convertContent(content: string, options: ConversionOptions): ConversionResult {
		let result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};
		
		// Apply conversions in order
		for (const variant of this.variants) {
			if (variant.detector(result.convertedContent)) {
				const conversionResult = variant.converter(result.convertedContent, options);
				result.convertedContent = conversionResult.convertedContent;
				result.warnings.push(...conversionResult.warnings);
				result.removedElements.push(...conversionResult.removedElements);
				result.changedElements.push(...conversionResult.changedElements);
			}
		}
		
		return result;
	}
	
	private calculateCompatibilityScore(detectedVariants: string[]): number {
		const totalVariants = this.variants.length;
		const incompatibleVariants = detectedVariants.length;
		return Math.max(0, Math.round(((totalVariants - incompatibleVariants) / totalVariants) * 100));
	}
	
	private generateRecommendations(detectedVariants: string[]): string[] {
		const recommendations: string[] = [];
		
		if (detectedVariants.includes('Obsidian Wikilinks')) {
			recommendations.push('Convert wikilinks to standard Markdown links for better compatibility');
		}
		if (detectedVariants.includes('Obsidian Callouts')) {
			recommendations.push('Convert callouts to standard blockquotes with emoji indicators');
		}
		if (detectedVariants.includes('Math Expressions')) {
			recommendations.push('Consider converting math expressions to code blocks or images');
		}
		if (detectedVariants.includes('Plugin Content')) {
			recommendations.push('Plugin-specific content may not render correctly in GitHub Gist');
		}
		
		return recommendations;
	}
	
	// Conversion method implementations
	private convertWikilinks(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		if (!options?.preserveWikilinks) {
			// Convert [[Page]] to [Page] or remove
			const wikilinkRegex = /\[\[(?!\!)([^\]|]+)\]\]/g;
			let match;
			
			while ((match = wikilinkRegex.exec(content)) !== null) {
				const originalText = match[0];
				const linkText = match[1];
				
				if (options?.compatibilityMode === 'strict') {
					// Remove wikilinks entirely in strict mode
					result.convertedContent = result.convertedContent.replace(originalText, linkText);
					result.removedElements.push(`Wikilink: ${originalText}`);
				} else {
					// Convert to plain text link in permissive mode
					const convertedText = `**${linkText}**`;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'wikilink'
					});
				}
			}
			
			if (result.changedElements.length > 0 || result.removedElements.length > 0) {
				result.warnings.push(`Converted ${result.changedElements.length + result.removedElements.length} wikilinks for Gist compatibility`);
			}
		}

		return result;
	}
	
	private convertImageWikilinks(content: string, options?: ConversionOptions): ConversionResult {
		// This will be handled by existing uploadImagesAndReplaceLinks method
		return { convertedContent: content, warnings: [], removedElements: [], changedElements: [] };
	}
	
	private convertTags(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		if (options?.convertTags) {
			// Convert #tag to **Tag:** tag format, but avoid markdown headers
			const tagRegex = /(?:^|\s)(#[\w\-\/]+)(?=\s|$|[^\w\-\/])/gm;
			let match;
			
			while ((match = tagRegex.exec(content)) !== null) {
				const originalText = match[1];
				const tagName = originalText.substring(1); // Remove #
				
				// Skip if it's at the beginning of a line (likely a header)
				const lineStart = content.lastIndexOf('\n', match.index) + 1;
				const beforeTag = content.substring(lineStart, match.index + match[0].indexOf(originalText));
				
				if (beforeTag.trim() === '') {
					// Likely a header, skip
					continue;
				}
				
				if (options?.compatibilityMode === 'strict') {
					// Remove tags in strict mode
					result.convertedContent = result.convertedContent.replace(originalText, '');
					result.removedElements.push(`Tag: ${originalText}`);
				} else {
					// Convert to readable format
					const convertedText = `\`${tagName}\``;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'tag'
					});
				}
			}
			
			if (result.changedElements.length > 0 || result.removedElements.length > 0) {
				result.warnings.push(`Processed ${result.changedElements.length + result.removedElements.length} tags for Gist compatibility`);
			}
		}

		return result;
	}
	
	private convertCallouts(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		if (options?.convertCallouts) {
			// Map callout types to emojis
			const calloutEmojis: { [key: string]: string } = {
				'note': '📝',
				'tip': '💡',
				'important': '❗',
				'warning': '⚠️',
				'caution': '🚨',
				'info': 'ℹ️',
				'success': '✅',
				'question': '❓',
				'failure': '❌',
				'danger': '🔥',
				'bug': '🐛',
				'example': '📋',
				'quote': '💬'
			};
			
			// Convert callouts like > [!note] Title
			const calloutRegex = />\s*\[!([\w\-]+)\](?:\s+([^\n]*?))?\n?((?:>.*\n?)*)/gm;
			let match;
			
			while ((match = calloutRegex.exec(content)) !== null) {
				const originalText = match[0];
				const calloutType = match[1].toLowerCase();
				const title = match[2] || calloutType;
				const calloutContent = match[3] || '';
				
				const emoji = calloutEmojis[calloutType] || '📄';
				
				if (options?.compatibilityMode === 'strict') {
					// Convert to simple blockquote
					const convertedText = `> **${title}**\n${calloutContent}`;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'callout'
					});
				} else {
					// Convert with emoji indicator
					const convertedText = `> ${emoji} **${title}**\n${calloutContent}`;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'callout'
					});
				}
			}
			
			if (result.changedElements.length > 0) {
				result.warnings.push(`Converted ${result.changedElements.length} callouts to blockquotes with emoji indicators`);
			}
		}

		return result;
	}
	
	private convertMath(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		// Handle block math ($$...$$)
		const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
		let match;
		
		while ((match = blockMathRegex.exec(content)) !== null) {
			const originalText = match[0];
			const mathContent = match[1].trim();
			
			if (options?.handleMath === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, '');
				result.removedElements.push(`Math block: ${originalText.substring(0, 50)}...`);
			} else if (options?.handleMath === 'convert') {
				const convertedText = `\`\`\`math\n${mathContent}\n\`\`\``;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'math-block'
				});
			}
			// 'preserve' mode: keep as is
		}
		
		// Handle inline math ($...$)
		const inlineMathRegex = /\$([^$\n]+)\$/g;
		
		while ((match = inlineMathRegex.exec(result.convertedContent)) !== null) {
			const originalText = match[0];
			const mathContent = match[1].trim();
			
			if (options?.handleMath === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, mathContent);
				result.removedElements.push(`Inline math: ${originalText}`);
			} else if (options?.handleMath === 'convert') {
				const convertedText = `\`${mathContent}\``;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'math-inline'
				});
			}
		}
		
		const totalMathElements = result.changedElements.length + result.removedElements.length;
		if (totalMathElements > 0) {
			result.warnings.push(`Processed ${totalMathElements} mathematical expressions - they may not render correctly in GitHub Gist`);
		}

		return result;
	}
	
	private convertPluginContent(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		// Handle Mermaid diagrams
		const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
		let match;
		
		while ((match = mermaidRegex.exec(content)) !== null) {
			const originalText = match[0];
			const diagramContent = match[1];
			
			if (options?.handlePluginContent === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, '');
				result.removedElements.push('Mermaid diagram');
			} else {
				// Convert to labeled code block
				const convertedText = `**📊 Mermaid Diagram:**\n\`\`\`\n${diagramContent}\n\`\`\``;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'mermaid'
				});
			}
		}
		
		// Handle Dataview queries
		const dataviewRegex = /```dataview\n([\s\S]*?)\n```/g;
		
		while ((match = dataviewRegex.exec(result.convertedContent)) !== null) {
			const originalText = match[0];
			const queryContent = match[1];
			
			if (options?.handlePluginContent === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, '');
				result.removedElements.push('Dataview query');
			} else {
				const convertedText = `**📈 Dataview Query:**\n\`\`\`sql\n${queryContent}\n\`\`\``;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'dataview'
				});
			}
		}
		
		// Handle comments %%...%%
		const commentRegex = /%%[\s\S]*?%%/g;
		
		while ((match = commentRegex.exec(result.convertedContent)) !== null) {
			const originalText = match[0];
			
			// Always remove comments as they're not meant to be published
			result.convertedContent = result.convertedContent.replace(originalText, '');
			result.removedElements.push('Obsidian comment');
		}
		
		// Handle Admonition plugin syntax
		const admonitionRegex = /```ad-([\w\-]+)\n(?:title: (.*)\n)?([\s\S]*?)\n```/g;
		
		while ((match = admonitionRegex.exec(result.convertedContent)) !== null) {
			const originalText = match[0];
			const adType = match[1];
			const title = match[2] || adType;
			const adContent = match[3];
			
			if (options?.handlePluginContent === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, adContent);
				result.removedElements.push(`Admonition: ${adType}`);
			} else {
				// Convert to blockquote with emoji
				const emoji = adType === 'warning' ? '⚠️' : adType === 'note' ? '📝' : '📄';
				const convertedText = `> ${emoji} **${title}**\n> \n> ${adContent.replace(/\n/g, '\n> ')}`;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'admonition'
				});
			}
		}
		
		const totalPluginElements = result.changedElements.length + result.removedElements.length;
		if (totalPluginElements > 0) {
			result.warnings.push(`Processed ${totalPluginElements} plugin-specific elements that may not render correctly in GitHub Gist`);
		}

		return result;
	}
}

export default class QuickShareNotePlugin extends Plugin {
	settings: QuickShareNotePluginSettings;
	private compatibilityHandler: MarkdownCompatibilityHandler;
	private isPublishing: boolean = false;

	async onload() {
		try {
			await this.loadSettings();
			this.compatibilityHandler = new MarkdownCompatibilityHandler();
			this.addSettingTab(new QuickShareNoteSettingTab(this.app, this));

			this.addCommand({
				id: 'publish-note-to-gist',
				name: 'Publish note to GitHub gist',
				callback: () => this.publishNoteToGist(),
			});

			this.addCommand({
				id: 'analyze-markdown-compatibility',
				name: 'Analyze Markdown compatibility',
				callback: () => this.analyzeCurrentNoteCompatibility(),
			});
		} catch (error) {
			console.error('Failed to load Quick Share Note plugin:', error);
			new Notice('Failed to initialize Quick Share Note plugin');
		}
	}

	/**
	 * Publishes the active note to GitHub gist with image uploads to Imgur
	 */
	async publishNoteToGist() {
		// Prevent multiple simultaneous publishing operations
		if (this.isPublishing) {
			new Notice('Publishing already in progress. Please wait...');
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file found');
			return;
		}

		// Validate settings before proceeding
		if (!this.validateSettings()) {
			return;
		}

		this.isPublishing = true;
		let progressNotice = new Notice(`Preparing to publish: ${activeFile.name}...`, 0);
		
		try {
			const fileContent = await this.app.vault.read(activeFile);
			
			progressNotice.setMessage(`Processing images in: ${activeFile.name}...`);
			const updatedContent = await this.uploadImagesAndReplaceLinks(fileContent, (current, total) => {
				progressNotice.setMessage(`Uploading images: ${current}/${total} - ${activeFile.name}`);
			});

			const gistIdMatch = updatedContent.match(/gist-publish-url: https.*\/(.*)/);

			const contentToPublish = this.prepareContentForPublishing(updatedContent, activeFile.name);

			const gistUrl = await this.publishToGist(gistIdMatch, activeFile.name, contentToPublish, progressNotice);
			await this.finalizePublishing(activeFile, gistUrl, progressNotice);
			
			progressNotice.hide();
			new Notice('✅ Note published to GitHub gist successfully');
		} catch (error) {
			progressNotice.hide();
			this.handlePublishError(error);
		} finally {
			this.isPublishing = false;
		}
	}

	/**
	 * Analyzes current note's Markdown compatibility with GitHub Gist
	 */
	async analyzeCurrentNoteCompatibility() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file found');
			return;
		}

		try {
			const fileContent = await this.app.vault.read(activeFile);
			const parsed = this.parseFrontmatter(fileContent);
			const report = this.compatibilityHandler.analyzeContent(parsed.content);

			// Create detailed compatibility report
			const reportLines = [
				`# Markdown Compatibility Report for "${activeFile.name}"`,
				'',
				`**Compatibility Score:** ${report.compatibilityScore}/100`,
				'',
				'## Detected Markdown Variants:'
			];

			if (report.detectedVariants.length === 0) {
				reportLines.push('✅ **No compatibility issues found!** Your note uses standard Markdown that will render perfectly in GitHub Gist.');
			} else {
				reportLines.push('The following Obsidian-specific elements were detected:');
				reportLines.push('');
				report.detectedVariants.forEach(variant => {
					reportLines.push(`- **${variant}**`);
				});
			}

			if (report.recommendations.length > 0) {
				reportLines.push('');
				reportLines.push('## Recommendations:');
				report.recommendations.forEach(rec => {
					reportLines.push(`- ${rec}`);
				});
			}

			reportLines.push('');
			reportLines.push('---');
			reportLines.push('*This report was generated by the Quick Share Note to Gist plugin*');

			// Display the report in a modal or new note
			const reportContent = reportLines.join('\n');
			
			// For now, show in notice and copy to clipboard
			navigator.clipboard.writeText(reportContent);
			new Notice(`Compatibility analysis complete! Score: ${report.compatibilityScore}/100\nDetailed report copied to clipboard.`, 5000);
			
		} catch (error) {
			console.error('Failed to analyze compatibility:', error);
			new Notice('Failed to analyze note compatibility');
		}
	}


	/**
	 * Prepares content for publishing by handling frontmatter, compatibility conversion, and adding header
	 */
	private prepareContentForPublishing(content: string, fileName: string): string {
		const parsed = this.parseFrontmatter(content);
		
		// Apply Markdown compatibility conversions
		const conversionOptions: ConversionOptions = {
			compatibilityMode: this.settings.compatibilityMode,
			preserveWikilinks: this.settings.preserveWikilinks,
			convertTags: this.settings.convertTags,
			convertCallouts: this.settings.convertCallouts,
			handleMath: this.settings.handleMath,
			handlePluginContent: this.settings.handlePluginContent
		};
		
		const conversionResult = this.compatibilityHandler.convertContent(parsed.content, conversionOptions);
		
		// Show compatibility warnings if enabled
		if (this.settings.showCompatibilityReport && conversionResult.warnings.length > 0) {
			conversionResult.warnings.forEach(warning => {
				console.log('Compatibility warning:', warning);
			});
			
			if (conversionResult.changedElements.length > 0 || conversionResult.removedElements.length > 0) {
				const totalChanges = conversionResult.changedElements.length + conversionResult.removedElements.length;
				new Notice(`Applied ${totalChanges} compatibility conversions for GitHub Gist`, 3000);
			}
		}
		
		const frontmatter = this.settings.showFrontmatter && parsed.hasFrontmatter ? parsed.frontmatter : '';
		const fileNameWithoutSuffix = fileName.replace(/\.[^/.]+$/, '');
		const header = `# ${fileNameWithoutSuffix}\n\n`;
		
		return frontmatter + header + conversionResult.convertedContent;
	}

	/**
	 * Publishes content to GitHub gist (create or update)
	 */
	private async publishToGist(gistIdMatch: RegExpMatchArray | null, fileName: string, content: string, progressNotice: Notice): Promise<string> {
		progressNotice.setMessage(gistIdMatch ? 
			`Updating existing gist: ${fileName}...` : 
			`Creating new gist: ${fileName}...`);
			
		const response = gistIdMatch ? 
			await this.updateGist(gistIdMatch[1], fileName, content) 
			: await this.createNewGist(fileName, content);

		return response.json.html_url;
	}

	/**
	 * Finalizes publishing by updating frontmatter and copying URL to clipboard
	 */
	private async finalizePublishing(file: TFile, gistUrl: string, progressNotice: Notice): Promise<void> {
		progressNotice.setMessage(`Finalizing: ${file.name}...`);
		
		this.copyLinkToClipboard(gistUrl);
		await this.updateFrontmatter(file, gistUrl);
	}

	/**
	 * Creates a new GitHub gist
	 */
	async createNewGist(activeFileName: string, contentToPublish: string) {
		try {
			return await requestUrl({
				url: GITHUB_API_URL,
				method: 'POST',
				headers: {
					Authorization: `token ${this.settings.githubToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					files: {
						[activeFileName]: {
							content: contentToPublish,
						},
					},
					public: false,
				}),
			});
		} catch (error) {
			throw new Error(`Failed to create gist: ${this.getErrorMessage(error)}`);
		}
	}

	/**
	 * Updates an existing GitHub gist
	 */
	async updateGist(gistId: string, activeFileName: string, contentToPublish: string) {
		try {
			return await requestUrl({
				url: `${GITHUB_API_URL}/${gistId}`,
				method: 'PATCH',
				headers: {
					Authorization: `token ${this.settings.githubToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					files: {
						[activeFileName]: {
							content: contentToPublish,
						},
					},
				}),
			});
		} catch (error) {
			throw new Error(`Failed to update gist: ${this.getErrorMessage(error)}`);
		}
	}

	async addHeaderToContent(file: TFile) {
		const fileContent = await this.app.vault.read(file);
		const header = `# ${file.name}\n\n`;
		const newContent = header + fileContent;
		await this.app.vault.modify(file, newContent);
	}

	/**
	 * Updates the frontmatter of a file with the gist URL
	 */
	async updateFrontmatter(file: TFile, url: string) {
		try {
			const fileContent = await this.app.vault.read(file);
			const parsed = this.parseFrontmatter(fileContent);
			
			let newContent: string;
			
			if (parsed.hasFrontmatter) {
				// Update existing frontmatter
				const frontmatterLines = parsed.frontmatter.split('\n').filter(line => line.trim());
				const gistUrlIndex = frontmatterLines.findIndex(line => line.startsWith('gist-publish-url:'));
				
				if (gistUrlIndex >= 0) {
					frontmatterLines[gistUrlIndex] = `gist-publish-url: ${url}`;
				} else {
					frontmatterLines.push(`gist-publish-url: ${url}`);
				}
				
				const updatedFrontmatter = '---\n' + frontmatterLines.join('\n') + '\n---\n';
				newContent = updatedFrontmatter + parsed.content;
			} else {
				// Add new frontmatter
				newContent = `---\ngist-publish-url: ${url}\n---\n${fileContent}`;
			}

			await this.app.vault.modify(file, newContent);
		} catch (error) {
			console.error('Failed to update frontmatter:', error);
			throw new Error(`Failed to update file frontmatter: ${this.getErrorMessage(error)}`);
		}
	}

	/**
	 * Processes content to upload images to Imgur and replace links
	 */
	async uploadImagesAndReplaceLinks(content: string, progressCallback?: (current: number, total: number) => void): Promise<string> {
		const imageRegex = /!\[\[(.*?)\]\]/g;
		const activeFile = this.app.workspace.getActiveFile();
		const notePath = activeFile ? activeFile.path.replace(/[^/]+$/, '') : '';
		
		// Find all matches first to avoid regex state issues with global flag
		const matches = Array.from(content.matchAll(imageRegex));
		const totalImages = matches.length;
		
		for (let i = 0; i < matches.length; i++) {
			const match = matches[i];
			
			if (progressCallback) {
				progressCallback(i + 1, totalImages);
			}
			
			try {
				const attachFile = this.app.metadataCache.getFirstLinkpathDest(match[1], notePath);
				if (attachFile == null) {
					console.warn(`Image not found: ${match[1]}`);
					continue;
				}
				const imageData = await this.app.vault.adapter.readBinary(attachFile.path);
				const imageUrl = await this.uploadImageToImgur(imageData);
				content = content.replace(match[0], `![Uploaded Image](${imageUrl})`);
			} catch (error) {
				console.error(`Failed to upload image ${match[1]}:`, error);
				// Keep original link if upload fails
				content = content.replace(match[0], `![Image Upload Failed](${match[1]})`);
			}
		}
		return content;
	}

	/**
	 * Uploads image data to Imgur
	 */
	async uploadImageToImgur(imageData: ArrayBuffer): Promise<string> {
		try {
			const response = await requestUrl({
				url: IMGUR_API_URL,
				method: 'POST',
				body: imageData,
				headers: {
					Authorization: `Client-ID ${this.settings.imgurClientId}`,
					'Content-Type': 'application/octet-stream',
				},
			});
			
			if (!response.json?.data?.link) {
				throw new Error('Invalid response from Imgur API');
			}
			
			return response.json.data.link;
		} catch (error) {
			throw new Error(`Failed to upload image to Imgur: ${this.getErrorMessage(error)}`);
		}
	}

	/**
	 * Copies the gist URL to clipboard
	 */
	copyLinkToClipboard(link: string) {
		navigator.clipboard.writeText(link).then(() => {
			new Notice('Gist URL copied to clipboard');
		}, (err) => {
			console.error('Failed to copy to clipboard:', err);
			new Notice('Failed to copy gist URL to clipboard');
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		try {
			await this.saveData(this.settings);
		} catch (error) {
			console.error('Failed to save settings:', error);
			new Notice('Failed to save plugin settings');
		}
	}

	/**
	 * Validates plugin settings before API operations
	 */
	private validateSettings(): boolean {
		if (!this.settings.githubToken.trim()) {
			new Notice('GitHub token is required. Please configure it in plugin settings.');
			return false;
		}
		
		if (!this.settings.imgurClientId.trim()) {
			new Notice('Imgur client ID is required. Please configure it in plugin settings.');
			return false;
		}
		
		// Basic GitHub token format validation
		if (!this.settings.githubToken.match(/^gh[a-z]_[A-Za-z0-9_]+$/) && 
			!this.settings.githubToken.match(/^[a-f0-9]{40}$/)) {
			new Notice('GitHub token appears to be invalid. Please check your token format.');
			return false;
		}
		
		return true;
	}

	/**
	 * Handles publishing errors with user-friendly messages
	 */
	private handlePublishError(error: any) {
		console.error('Publish error:', error);
		
		const errorMessage = this.getErrorMessage(error);
		
		if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
			new Notice('GitHub authentication failed. Please check your GitHub token.');
		} else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
			new Notice('GitHub API access denied. Check your token permissions or rate limits.');
		} else if (errorMessage.includes('404')) {
			new Notice('Gist not found. It may have been deleted.');
		} else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
			new Notice('Network error. Please check your internet connection.');
		} else if (errorMessage.includes('Imgur')) {
			new Notice('Image upload failed. Please check your Imgur client ID.');
		} else {
			new Notice(`Failed to publish note: ${errorMessage}`);
		}
	}

	/**
	 * Robust frontmatter parser that handles edge cases
	 */
	private parseFrontmatter(content: string): FrontmatterData {
		if (!content.startsWith('---')) {
			return {
				frontmatter: '',
				content: content,
				hasFrontmatter: false
			};
		}
		
		const lines = content.split('\n');
		let endIndex = -1;
		
		// Find the closing --- delimiter
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				endIndex = i;
				break;
			}
		}
		
		if (endIndex === -1) {
			// No closing delimiter found, treat as regular content
			return {
				frontmatter: '',
				content: content,
				hasFrontmatter: false
			};
		}
		
		const frontmatterLines = lines.slice(1, endIndex);
		const contentLines = lines.slice(endIndex + 1);
		
		return {
			frontmatter: '---\n' + frontmatterLines.join('\n') + '\n---\n',
			content: contentLines.join('\n'),
			hasFrontmatter: true
		};
	}

	/**
	 * Extracts meaningful error message from error objects
	 */
	private getErrorMessage(error: any): string {
		if (typeof error === 'string') {
			return error;
		}
		
		if (error?.message) {
			return error.message;
		}
		
		if (error?.json?.message) {
			return error.json.message;
		}
		
		if (error?.status) {
			return `HTTP ${error.status}: ${error.statusText || 'Request failed'}`;
		}
		
		return 'Unknown error occurred';
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

		new Setting(containerEl)
			.setName('GitHub token')
			.setDesc('Enter your GitHub personal access token (requires gist scope)')
			.addText(text => {
				text.setPlaceholder('ghp_xxxxxxxxxxxxxxxxxxxx or classic 40-char token')
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value;
						await this.plugin.saveSettings();
						
						// Validate token format
						const isValid = value.trim() === '' || 
							value.match(/^gh[a-z]_[A-Za-z0-9_]+$/) || 
							value.match(/^[a-f0-9]{40}$/);
						
						text.inputEl.style.borderColor = isValid ? '' : '#ff6b6b';
					});
				return text;
			});

		new Setting(containerEl)
			.setName('Imgur client ID')
			.setDesc('Enter your Imgur application client ID for image uploads')
			.addText(text => {
				text.setPlaceholder('17-character alphanumeric ID')
					.setValue(this.plugin.settings.imgurClientId)
					.onChange(async (value) => {
						this.plugin.settings.imgurClientId = value;
						await this.plugin.saveSettings();
						
						// Validate client ID format (typically 15-17 characters)
						const isValid = value.trim() === '' || 
							value.match(/^[a-f0-9]{15,17}$/i);
						
						text.inputEl.style.borderColor = isValid ? '' : '#ff6b6b';
					});
				return text;
			});

		new Setting(containerEl)
			.setName('Show frontmatter')
			.setDesc('Show frontmatter in published note')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showFrontmatter)
				.onChange(async (value) => {
					this.plugin.settings.showFrontmatter = value;
					await this.plugin.saveSettings();
				}));

		// Markdown Compatibility Settings
		containerEl.createEl('h3', { text: 'Markdown Compatibility Settings' });
		containerEl.createEl('p', { 
			text: 'Configure how Obsidian-specific Markdown elements are converted for GitHub Gist compatibility.',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Compatibility mode')
			.setDesc('Strict mode removes incompatible elements, Permissive mode converts them when possible')
			.addDropdown(dropdown => dropdown
				.addOption('strict', 'Strict (Remove incompatible elements)')
				.addOption('permissive', 'Permissive (Convert when possible)')
				.setValue(this.plugin.settings.compatibilityMode)
				.onChange(async (value: 'strict' | 'permissive') => {
					this.plugin.settings.compatibilityMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Convert wikilinks')
			.setDesc('Convert [[wikilinks]] to bold text format')
			.addToggle(toggle => toggle
				.setValue(!this.plugin.settings.preserveWikilinks)
				.onChange(async (value) => {
					this.plugin.settings.preserveWikilinks = !value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Convert tags')
			.setDesc('Convert #tags to inline code format')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convertTags)
				.onChange(async (value) => {
					this.plugin.settings.convertTags = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Convert callouts')
			.setDesc('Convert > [!note] callouts to blockquotes with emoji indicators')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convertCallouts)
				.onChange(async (value) => {
					this.plugin.settings.convertCallouts = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Handle math expressions')
			.setDesc('How to handle LaTeX math expressions ($$ or $)')
			.addDropdown(dropdown => dropdown
				.addOption('convert', 'Convert to code blocks')
				.addOption('preserve', 'Keep as-is (may not render)')
				.addOption('remove', 'Remove math expressions')
				.setValue(this.plugin.settings.handleMath)
				.onChange(async (value: 'remove' | 'convert' | 'preserve') => {
					this.plugin.settings.handleMath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Handle plugin content')
			.setDesc('How to handle Mermaid, Dataview, and other plugin-specific content')
			.addDropdown(dropdown => dropdown
				.addOption('convert', 'Convert to labeled code blocks')
				.addOption('remove', 'Remove plugin content')
				.setValue(this.plugin.settings.handlePluginContent)
				.onChange(async (value: 'remove' | 'convert') => {
					this.plugin.settings.handlePluginContent = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show compatibility reports')
			.setDesc('Show notifications about compatibility conversions during publishing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCompatibilityReport)
				.onChange(async (value) => {
					this.plugin.settings.showCompatibilityReport = value;
					await this.plugin.saveSettings();
				}));

		// Add compatibility analysis button
		new Setting(containerEl)
			.setName('Analyze current note')
			.setDesc('Analyze the current note for Markdown compatibility issues')
			.addButton(button => button
				.setButtonText('Analyze Compatibility')
				.setCta()
				.onClick(() => {
					this.plugin.analyzeCurrentNoteCompatibility();
				}));
	}
}
