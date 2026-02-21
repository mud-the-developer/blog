const { Plugin, PluginSettingTab, Setting, Modal, Notice, normalizePath, moment } = require('obsidian');

const DEFAULT_SETTINGS = {
  publishedPath: 'content/posts/published',
  draftPath: 'content/posts/drafts',
  defaultTags: 'blog',
  dateFormat: 'YYYY-MM-DD HH:mm'
};

class TitlePromptModal extends Modal {
  constructor(app, label, onSubmit) {
    super(app);
    this.label = label;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: this.label });
    const input = contentEl.createEl('input', { type: 'text' });
    input.style.width = '100%';
    input.placeholder = '포스트 제목';
    input.focus();

    const submit = () => {
      const value = input.value.trim();
      if (!value) {
        new Notice('제목을 입력해줘');
        return;
      }
      this.close();
      this.onSubmit(value);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    const btn = contentEl.createEl('button', { text: '생성' });
    btn.onclick = submit;
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = class BlogHelperPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: 'new-post-published',
      name: 'Blog Helper: New Post (Published)',
      callback: () => {
        new TitlePromptModal(this.app, 'Published 글 제목', async (title) => {
          await this.createPost(title, false);
        }).open();
      }
    });

    this.addCommand({
      id: 'new-post-draft',
      name: 'Blog Helper: New Post (Draft)',
      callback: () => {
        new TitlePromptModal(this.app, 'Draft 글 제목', async (title) => {
          await this.createPost(title, true);
        }).open();
      }
    });

    this.addCommand({
      id: 'update-lastmod',
      name: 'Blog Helper: Update Lastmod',
      callback: async () => {
        await this.updateLastmod();
      }
    });

    this.addSettingTab(new BlogHelperSettingTab(this.app, this));
  }

  slugify(title) {
    return title
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '')
      .replace(/-+/g, '-');
  }

  now() {
    return moment().format(this.settings.dateFormat);
  }

  async createPost(title, draft) {
    const folder = normalizePath(draft ? this.settings.draftPath : this.settings.publishedPath);
    const slug = this.slugify(title);
    const filePath = normalizePath(`${folder}/${slug}.md`);

    await this.ensureFolder(folder);

    const tags = this.settings.defaultTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .join(', ');

    const body = `---\ntitle: "${title}"\ndate: ${this.now()}\nlastmod: ${this.now()}\ndraft: ${draft ? 'true' : 'false'}\ntags: [${tags}]\ndescription: ""\n---\n\n# ${title}\n\n`;

    if (this.app.vault.getAbstractFileByPath(filePath)) {
      new Notice(`이미 존재함: ${filePath}`);
      return;
    }

    const file = await this.app.vault.create(filePath, body);
    await this.app.workspace.getLeaf(true).openFile(file);
    new Notice(`생성 완료: ${filePath}`);
  }

  async ensureFolder(path) {
    const parts = path.split('/');
    let current = '';
    for (const p of parts) {
      current = current ? `${current}/${p}` : p;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async updateLastmod() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('활성 파일이 없어');
      return;
    }

    const content = await this.app.vault.read(file);
    if (!content.startsWith('---\n')) {
      new Notice('frontmatter가 없어');
      return;
    }

    const end = content.indexOf('\n---\n', 4);
    if (end === -1) {
      new Notice('frontmatter 파싱 실패');
      return;
    }

    const fm = content.slice(4, end);
    const rest = content.slice(end + 5);
    const now = this.now();

    let nextFm;
    if (/^lastmod\s*:/m.test(fm)) {
      nextFm = fm.replace(/^lastmod\s*:.*$/m, `lastmod: ${now}`);
    } else {
      nextFm = `${fm}\nlastmod: ${now}`;
    }

    const updated = `---\n${nextFm}\n---\n${rest}`;
    await this.app.vault.modify(file, updated);
    new Notice('lastmod 업데이트 완료');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};

class BlogHelperSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Published path')
      .setDesc('Published 글 저장 경로')
      .addText((text) =>
        text.setPlaceholder('content/posts/published')
          .setValue(this.plugin.settings.publishedPath)
          .onChange(async (value) => {
            this.plugin.settings.publishedPath = value.trim() || DEFAULT_SETTINGS.publishedPath;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
      .setName('Draft path')
      .setDesc('Draft 글 저장 경로')
      .addText((text) =>
        text.setPlaceholder('content/posts/drafts')
          .setValue(this.plugin.settings.draftPath)
          .onChange(async (value) => {
            this.plugin.settings.draftPath = value.trim() || DEFAULT_SETTINGS.draftPath;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
      .setName('Default tags')
      .setDesc('쉼표로 구분')
      .addText((text) =>
        text.setPlaceholder('blog,obsidian')
          .setValue(this.plugin.settings.defaultTags)
          .onChange(async (value) => {
            this.plugin.settings.defaultTags = value;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
      .setName('Date format')
      .setDesc('moment.js format')
      .addText((text) =>
        text.setPlaceholder('YYYY-MM-DD HH:mm')
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value.trim() || DEFAULT_SETTINGS.dateFormat;
            await this.plugin.saveSettings();
          }));
  }
}
